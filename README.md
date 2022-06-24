# MuseJS
Muse 2/S EEG Headset Vanilla Javascript Library.

This small Javascript library has no dependencies and enables the use of a Muse EEG Headset (version 2 and S) directly in the browser using Web Bluetooth. The EEG, PPG and Motion sensor data is collected into circular buffers that can be read by the application.

## Usage

Simply include Muse.js in your page, and create an instance of the Muse class:

```javascript
var muse = new Muse();
await muse.connect();
```

### Real-time EEG, PPG, Accelerometer and Gyroscope signals

After a connecting with the headset, the sensor data can now be read:

```javascript
for (var i=0;i<10;i++) console.log("EEG: " + muse.eeg[0].read());
for (var i=0;i<10;i++) console.log("PPG: " + muse.ppg[0].read());
for (var i=0;i<10;i++) console.log("Accelerometer: " + muse.accelerometer[0].read());
for (var i=0;i<10;i++) console.log("Gyroscope: " + muse.gyroscope[0].read());
```

The Library supports five EEG channels (eeg[0]-eeg[4]), three PPG channels (ppg[0]-ppg[2]), a 3-axis accelerometer (accelerometer[0]-accelerometer[2]) and a 3-axis gyroscope (gyroscope[0]-gyroscope[2]).

### Battery level

```javascript
console.log("Battery level: " + muse.batteryLevel + "%");
```

### Headset information

```javascript
console.log("Muse Firmware rev.: " + muse.info["fw"]);
```
