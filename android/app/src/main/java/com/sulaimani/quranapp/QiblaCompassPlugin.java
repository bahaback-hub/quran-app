package com.sulaimani.quranapp;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.view.Display;
import android.view.Surface;
import android.view.WindowManager;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Supplies a screen-aware, true-north heading for the Qibla reader.
 *
 * The WebView's DeviceOrientation alpha value is not a uniform compass heading
 * on Android. This bridge instead uses Android's fused rotation-vector sensor,
 * falls back to accelerometer plus magnetometer, compensates screen rotation,
 * and corrects magnetic north to true north using the current location.
 */
@CapacitorPlugin(name = "QiblaCompass")
public class QiblaCompassPlugin extends Plugin implements SensorEventListener {
    private static final long MIN_EVENT_INTERVAL_MS = 120L;
    private static final float MIN_HEADING_CHANGE_DEGREES = 1.5f;

    private SensorManager sensorManager;
    private Sensor rotationVectorSensor;
    private Sensor accelerometerSensor;
    private Sensor magnetometerSensor;
    private final float[] accelerometerValues = new float[3];
    private final float[] magnetometerValues = new float[3];
    private boolean hasAccelerometer;
    private boolean hasMagnetometer;
    private boolean running;
    private float latitude;
    private float longitude;
    private float altitude;
    private float declination;
    private int accuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
    private float lastHeading = Float.NaN;
    private long lastEventTime;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
            accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            magnetometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (sensorManager == null) {
            call.reject("Compass sensors are not available on this device");
            return;
        }

        Double requestedLatitude = call.getDouble("latitude");
        Double requestedLongitude = call.getDouble("longitude");
        if (requestedLatitude == null || requestedLongitude == null) {
            call.reject("Latitude and longitude are required for a true-north heading");
            return;
        }

        latitude = requestedLatitude.floatValue();
        longitude = requestedLongitude.floatValue();
        altitude = call.getDouble("altitude", 0d).floatValue();
        declination = new GeomagneticField(latitude, longitude, altitude, System.currentTimeMillis()).getDeclination();
        lastHeading = Float.NaN;
        lastEventTime = 0L;
        hasAccelerometer = false;
        hasMagnetometer = false;

        boolean registered = false;
        if (rotationVectorSensor != null) {
            registered = sensorManager.registerListener(this, rotationVectorSensor, SensorManager.SENSOR_DELAY_UI);
        } else if (accelerometerSensor != null && magnetometerSensor != null) {
            boolean accelerometerRegistered = sensorManager.registerListener(
                this,
                accelerometerSensor,
                SensorManager.SENSOR_DELAY_UI
            );
            boolean magnetometerRegistered = sensorManager.registerListener(
                this,
                magnetometerSensor,
                SensorManager.SENSOR_DELAY_UI
            );
            registered = accelerometerRegistered && magnetometerRegistered;
        }

        if (!registered) {
            call.reject("A compatible compass sensor is not available on this device");
            return;
        }

        running = true;
        JSObject result = new JSObject();
        result.put("source", rotationVectorSensor != null ? "rotation-vector" : "accelerometer-magnetometer");
        result.put("declination", declination);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopListening();
        call.resolve();
    }

    @Override
    public void handleOnDestroy() {
        stopListening();
    }

    private void stopListening() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        running = false;
        hasAccelerometer = false;
        hasMagnetometer = false;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!running) {
            return;
        }

        float[] rotationMatrix = new float[9];
        boolean hasRotationMatrix = false;
        if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR) {
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
            hasRotationMatrix = true;
        } else if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            System.arraycopy(event.values, 0, accelerometerValues, 0, accelerometerValues.length);
            hasAccelerometer = true;
        } else if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            System.arraycopy(event.values, 0, magnetometerValues, 0, magnetometerValues.length);
            hasMagnetometer = true;
        }

        if (!hasRotationMatrix && hasAccelerometer && hasMagnetometer) {
            hasRotationMatrix = SensorManager.getRotationMatrix(
                rotationMatrix,
                null,
                accelerometerValues,
                magnetometerValues
            );
        }
        if (!hasRotationMatrix) {
            return;
        }

        float[] remappedMatrix = new float[9];
        int[] axes = getScreenAxes();
        SensorManager.remapCoordinateSystem(rotationMatrix, axes[0], axes[1], remappedMatrix);
        float[] orientation = new float[3];
        SensorManager.getOrientation(remappedMatrix, orientation);
        float magneticHeading = normalize((float) Math.toDegrees(orientation[0]));
        float trueHeading = normalize(magneticHeading + declination);
        notifyHeading(trueHeading, magneticHeading);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int newAccuracy) {
        accuracy = newAccuracy;
        if (running) {
            JSObject data = new JSObject();
            data.put("accuracy", accuracyLabel());
            data.put("isReliable", isReliable());
            notifyListeners("accuracyChange", data);
        }
    }

    @NonNull
    private int[] getScreenAxes() {
        WindowManager windowManager = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
        Display display = windowManager != null ? windowManager.getDefaultDisplay() : null;
        int rotation = display != null ? display.getRotation() : Surface.ROTATION_0;
        switch (rotation) {
            case Surface.ROTATION_90:
                return new int[]{SensorManager.AXIS_Y, SensorManager.AXIS_MINUS_X};
            case Surface.ROTATION_180:
                return new int[]{SensorManager.AXIS_MINUS_X, SensorManager.AXIS_MINUS_Y};
            case Surface.ROTATION_270:
                return new int[]{SensorManager.AXIS_MINUS_Y, SensorManager.AXIS_X};
            case Surface.ROTATION_0:
            default:
                return new int[]{SensorManager.AXIS_X, SensorManager.AXIS_Y};
        }
    }

    private void notifyHeading(float trueHeading, float magneticHeading) {
        long now = System.currentTimeMillis();
        if (now - lastEventTime < MIN_EVENT_INTERVAL_MS) {
            return;
        }
        if (!Float.isNaN(lastHeading) && circularDifference(trueHeading, lastHeading) < MIN_HEADING_CHANGE_DEGREES) {
            return;
        }
        lastEventTime = now;
        lastHeading = trueHeading;

        JSObject data = new JSObject();
        data.put("heading", trueHeading);
        data.put("magneticHeading", magneticHeading);
        data.put("declination", declination);
        data.put("accuracy", accuracyLabel());
        data.put("isReliable", isReliable());
        notifyListeners("headingChange", data);
    }

    private boolean isReliable() {
        return accuracy >= SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM;
    }

    private String accuracyLabel() {
        switch (accuracy) {
            case SensorManager.SENSOR_STATUS_ACCURACY_HIGH:
                return "high";
            case SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM:
                return "medium";
            case SensorManager.SENSOR_STATUS_ACCURACY_LOW:
                return "low";
            case SensorManager.SENSOR_STATUS_UNRELIABLE:
            default:
                return "unreliable";
        }
    }

    private float normalize(float value) {
        float normalized = value % 360f;
        return normalized < 0f ? normalized + 360f : normalized;
    }

    private float circularDifference(float first, float second) {
        float difference = Math.abs(first - second);
        return difference > 180f ? 360f - difference : difference;
    }
}
