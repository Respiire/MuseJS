/**
 * @name MuseJS
 * @version 1.0 | June 2022
 * @author  Respiire Health Systems Inc.
 * @license MIT
 */

class MuseCircularBuffer {
  constructor(size) {
    this.memory = new Array(size);
    for (var i=0;i<size;i++) this.memory[i]=0;
    this.head = 0;
    this.tail = 0;
    this.isFull = false;
    this.lastwrite = 0;
    this.length = 0;
  }
  read() {
    if (this.tail == this.head && !this.isFull) {
      return null;
    } else {
      this.tail = this.next(this.tail);
      this.isFull = false;
      this.length+=-1;
      return this.memory[this.tail];
    }
  }
  write(value) {
    this.lastwrite = Date.now();
    if (this.isFull) {
      return;
    } else {
      this.head = this.next(this.head);
      this.memory[this.head] = value;
      if (this.head == this.tail) {
        this.isFull = true;
      }
      this.length+=1;
    }
  }
  next(n) {
    var nxt = n + 1;
    if (nxt == this.memory.length) {
      return 0;
    } else {
      return nxt;
    }
  }
}

class Muse {
  constructor() {
    var BUFFER_SIZE = 256;
    this.SERVICE = 0xfe8d;
    this.CONTROL_CHARACTERISTIC = '273e0001-4c4d-454d-96be-f03bac821358';
    this.BATTERY_CHARACTERISTIC = '273e000b-4c4d-454d-96be-f03bac821358';
    this.GYROSCOPE_CHARACTERISTIC = '273e0009-4c4d-454d-96be-f03bac821358';
    this.ACCELEROMETER_CHARACTERISTIC = '273e000a-4c4d-454d-96be-f03bac821358';
    this.PPG1_CHARACTERISTIC = '273e000f-4c4d-454d-96be-f03bac821358'; // AMBIENT
    this.PPG2_CHARACTERISTIC = '273e0010-4c4d-454d-96be-f03bac821358'; // IR
    this.PPG3_CHARACTERISTIC = '273e0011-4c4d-454d-96be-f03bac821358'; // RED
    this.EEG1_CHARACTERISTIC = '273e0003-4c4d-454d-96be-f03bac821358';  // TP9
    this.EEG2_CHARACTERISTIC = '273e0004-4c4d-454d-96be-f03bac821358';  // FP1
    this.EEG3_CHARACTERISTIC = '273e0005-4c4d-454d-96be-f03bac821358';  // FP2
    this.EEG4_CHARACTERISTIC = '273e0006-4c4d-454d-96be-f03bac821358';  // TP10
    this.EEG5_CHARACTERISTIC = '273e0007-4c4d-454d-96be-f03bac821358';  // AUX
    this.state = 0;
    this.dev = null;
    this.controlChar = null;
    this.batteryLevel = null;
    this.info = { };
    this.infoFragment = "";
    this.eeg = [
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE)
    ];
    this.ppg = [
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE)
    ];
    this.accelerometer = [
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE)
    ];
    this.gyroscope = [
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE),
      new MuseCircularBuffer(BUFFER_SIZE)
    ];
  }
  decodeInfo(bytes) {
    return new TextDecoder().decode(bytes.subarray(1, 1 + bytes[0]));
  }
  decodeUnsigned24BitData(samples) {
    const samples24Bit = [];
    for (let i = 0; i < samples.length; i = i + 3) {
      samples24Bit.push((samples[i] << 16) | (samples[i + 1] << 8) | samples[i + 2]);
    }
    return samples24Bit;
  }
  decodeUnsigned12BitData(samples) {
    const samples12Bit = [];
    for (let i = 0; i < samples.length; i++) {
      if (i % 3 === 0) {
         samples12Bit.push((samples[i] << 4) | (samples[i + 1] >> 4));
      } else {
        samples12Bit.push(((samples[i] & 0xf) << 8) | samples[i + 1]);
        i++;
      }
    }
    return samples12Bit;
  }
  encodeCommand(cmd) {
    const encoded = new TextEncoder().encode(`X${cmd}\n`);
    encoded[0] = encoded.length - 1;
    return encoded;
  }
  // -------------------------------------
  batteryData (event) {
    var data = event.target.value;
    data = data.buffer ? data: new DataView(data);
    this.batteryLevel = data.getUint16(2) / 512;
  }
  motionData(dv,scale,ofs) {
    return [ 
      scale*dv.getInt16(ofs),
      scale*dv.getInt16(ofs+2),
      scale*dv.getInt16(ofs+4)
    ];
  }
  accelerometerData (event) {
    var scale = 0.0000610352;
    var data = event.target.value;
    data = data.buffer ? data: new DataView(data);
    var ofs = 2;
    for (var i=0;i<3;i++) {
       var vals = this.motionData(data,scale,ofs);
       this.accelerometer[0].write(vals[0]);
       this.accelerometer[1].write(vals[1]);
       this.accelerometer[2].write(vals[2]);
       ofs+=6;
    }
  }
  gyroscopeData (event) {
    var scale = 0.0074768;
    var data = event.target.value;
    data = data.buffer ? data: new DataView(data);
    var ofs = 2;
    for (var i=0;i<3;i++) {
       var vals = this.motionData(data,scale,ofs);
       this.gyroscope[0].write(vals[0]);
       this.gyroscope[1].write(vals[1]);
       this.gyroscope[2].write(vals[2]);
       ofs+=6;
    }
  }
  controlData (event) {
    var data = event.target.value;
    data = data.buffer ? data: new DataView(data);
    var buf = new Uint8Array(data.buffer);
    var str = this.decodeInfo(buf);
    for (var i = 0; i<str.length;i++) {
      var c = str[i];
      this.infoFragment = this.infoFragment + c;
      // { make bracket matching happy
      if (c=='}') {
        var tmp = JSON.parse(this.infoFragment);
        this.infoFragment = "";
        for (const key in tmp) {
          this.info[key] = tmp[key];
        }
      }
    }
  }
  eegData (n,event) {
    var data = event.target.value;
    data = data.buffer ? data: new DataView(data);
    var samples = this.decodeUnsigned12BitData(new Uint8Array(data.buffer).subarray(2));
    samples = samples.map(function (x) { return 0.48828125 * (x - 0x800); });
    for (var i=0;i<samples.length;i++) {
      this.eeg[n].write(samples[i]);
    }
  }
  ppgData(n,event) {
    var data = event.target.value;
    data = data.buffer ? data: new DataView(data);
    var samples = this.decodeUnsigned24BitData(new Uint8Array(data.buffer).subarray(2));
    for (var i=0;i<samples.length;i++) { 
      this.ppg[n].write(samples[i]); 
    }
  }
  // -------------------------------------
  async sendCommand(cmd) {
    await this.controlChar["writeValue"](this.encodeCommand(cmd));
  }
  async pause () {
    await this.sendCommand('h');
  }
  async resume () {
    await this.sendCommand('d');
  }
  async start () {
    await this.pause();
    // only EEG
    //await this.sendCommand('p21');
    // EEG + PPG
    await this.sendCommand('p50');
    await this.sendCommand('s');
    await this.resume();
  }
  disconnect() {
    if (this.dev) this.dev["gatt"]["disconnect"]();
    this.dev = null;
    this.state = 0;
  }
  onDisconnected() {
    this.dev = null;
    this.state=0;
  }
  async connectChar (service,cid,hook) {
    var c = await service["getCharacteristic"](cid);
    c["oncharacteristicvaluechanged"] = hook;
    c["startNotifications"]();
    return c;
  }
  async connect() {
    if (this.dev||this.state!=0) { return; }
    this.state=1;
    try {
      this.dev = await navigator["bluetooth"]["requestDevice"]({
        "filters": [{ "services": [this.SERVICE]}],
      });
    } catch (error) { 
      this.dev= null;
      this.state = 0;
      return;
    }
    try {
      var gatt = await this.dev["gatt"]["connect"]();
    } catch (error) {
      this.dev= null;
      this.state = 0;
      return;
    }
    var service = await gatt["getPrimaryService"](this.SERVICE);
    var that = this;
    this.dev.addEventListener('gattserverdisconnected',
      function () { that.onDisconnected(); } );
    this.controlChar = await this.connectChar(service,this.CONTROL_CHARACTERISTIC,
      function (event) { that.controlData(event); } );
    await this.connectChar(service,this.BATTERY_CHARACTERISTIC,
      function (event) { that.batteryData(event); } );
    await this.connectChar(service,this.GYROSCOPE_CHARACTERISTIC,
      function (event) { that.gyroscopeData(event); } );
    await this.connectChar(service,this.ACCELEROMETER_CHARACTERISTIC,
      function (event) { that.accelerometerData(event); } );
    await this.connectChar(service,this.PPG1_CHARACTERISTIC,
      function (event) { that.ppgData(0,event); } );
    await this.connectChar(service,this.PPG2_CHARACTERISTIC,
      function (event) { that.ppgData(1,event); } );
    await this.connectChar(service,this.PPG3_CHARACTERISTIC,
      function (event) { that.ppgData(2,event); } );
    await this.connectChar(service,this.EEG1_CHARACTERISTIC,
      function (event) { that.eegData(0,event); } );
    await this.connectChar(service,this.EEG2_CHARACTERISTIC,
      function (event) { that.eegData(1,event); } );
    await this.connectChar(service,this.EEG3_CHARACTERISTIC,
      function (event) { that.eegData(2,event); } );
    await this.connectChar(service,this.EEG4_CHARACTERISTIC,
      function (event) { that.eegData(3,event); } );
    await this.connectChar(service,this.EEG5_CHARACTERISTIC,
      function (event) { that.eegData(4,event); } );
    await this.start();
    await this.sendCommand('v1');
    this.state = 2;
  }
}

// eof
