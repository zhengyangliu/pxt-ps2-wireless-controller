/**
* A driver of PS2 wireless controller in MakeCode.
* @abstract This program is port from https://github.com/Lynxmotion/Arduino-PS2X, It's a lite version of Arduino-PS2X,
* can only be used in communicate with 2.4G PS2 wireless controller, other ps2 gamepads are not supported. The wareform 
* can be referenced from https://store.curiousinventor.com/guides/PS2.
* @author ArthurZheng
*/

namespace ps2 {
    export enum DigitalButton {
        //% block="Select"
        Select = 0x0001,
        //% block="L3"
        L3 = 0x0002,
        //% block="R3"
        R3 = 0x0004,
        //% block="Start"
        Start = 0x0008,
        //% block="Up"
        Up = 0x0010,
        //% block="Right"
        Right = 0x0020,
        //% block="Down"
        Down = 0x0040,
        //% block="Left"
        Left = 0x0080,
        //% block="L2"
        L2 = 0x0100,
        //% block="R2"
        R2 = 0x0200,
        //% block="L1"
        L1 = 0x0400,
        //% block="R1"
        R1 = 0x0800,
        //% block="Triangle"
        Triangle = 0x1000,
        //% block="Circle"
        Circle = 0x2000,
        //% block="Cross"
        Cross = 0x4000,
        //% block="Square"
        Square = 0x8000
    }

    export enum AnalogButton {
        //% block="RIGHT HORIZONTAL"
        RX = 5,
        //% block="RIGHT VERTICAL"
        RY = 6,
        //% block="LEFT HORIZONTAL"
        LX = 7,
        //% block="LEFT VERTICAL"
        LY = 8
    }

    let CS = 0, DO = 0, DI = 0, CLK = 0;
    let lastReadtime = 0;

    // Store read back data 
    let ps2Data = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    let btData = 0;

    // Time control
    const CTRL_BYTE_DELAY = 5;
    let readDelay = 1;

    // Command list
    const ENTER_CONFIG = [0x01, 0x43, 0x00, 0x01, 0x00];
    const SET_ANALOGMODE = [0x01, 0x44, 0x00, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00];
    const EXIT_CONFIG = [0x01, 0x43, 0x00, 0x00, 0x5A, 0x5A, 0x5A, 0x5A, 0x5A];
    const READ_DATA = [0x01, 0x42, 0, 0, 0, 0, 0, 0, 0];

    /**
     * Initialize ps2 controller and set pins, should run at first.
     * @param {DigitalPin} dout - DO pin name, eg: DigitalPin.P15
     * @param {DigitalPin} din - DI pin name, eg: DigitalPin.P14
     * @param {DigitalPin} clk - CLK pin name, eg: DigitalPin.P13
     * @param {DigitalPin} cs - CS pin name, eg: DigitalPin.P16
     * @return {number} 0 no error, 1 cannot communicat with wireless recreceiver, 2 cannot set wireless receiver mode
     */
    export function initGamepad(dout: DigitalPin, din: DigitalPin, clk: DigitalPin, cs: DigitalPin) {

        let temp = [0];

        // configure ports
        DO = dout;
        DI = din;
        CLK = clk;
        CS = cs;

        // set cs initial state
        pins.digitalWritePin(CS, 1);

        // configure spi
        pins.spiPins(DO, DI, CLK);
        pins.spiFormat(8, 3);
        pins.spiFrequency(250000);

        // new error checking. First, read gamepad a few times to see if it's talking
        readGamepad();
        readGamepad();
        //see if it talked - see if mode came back. 
        //If still anything but 41, 73 or 79, then it's not talking
        if (ps2Data[1] != 0x41 && ps2Data[1] != 0x73 && ps2Data[1] != 0x79) {
            return 1; //return error code 1
        }

        //try setting mode, increasing delays if need be.
        readDelay = 1;

        for (let y = 0; y <= 10; y++) {
            reconfigGamepad();
            readGamepad();

            if (ps2Data[1] == 0x73) {
                break;
            }

            if (y == 10) {
                return 2; //exit function with error
            }
            readDelay += 1; //add 1ms to readDelay
        }
        return 0; //no error if here
    }

    /**
     * reverse 8-bit data
     * @param {number} data - the data want to reverse.
     * @return {number} the reversed data
     * @note  The spi of ps2 is lsb, but spi of microbit is msb, and can not reconfig,
     * so we should transform the in/out data.
     */
    function reverseBitsInChar(data: number): number {
        let ret = 0;
        let i;
        for (i = 0; i < 8; i++) {
            ret <<= 1;
            ret |= data & 1;
            data >>= 1;
        }
        return ret;
    }

    /**
     * Send and recive data. 
     * @param {number} byte - the data to send , eg: 0x00
     * @return {number} back data
     */
    function inOutData(byte: number): number {
        return reverseBitsInChar(pins.spiWrite(reverseBitsInChar(byte)));
    }

    /**
     * Send and recive data. recive data is store in ps2Data and btData
     * @param {number} byte - the data to send , eg: 0x00
     * @return {number} 0 no error, 1 error
     */
    export function readGamepad() {

        let temp = input.runningTime() - lastReadtime;

        if (temp > 1500) {      //waited to long
            reconfigGamepad();
        }
        if (temp < readDelay) {  //waited too short
            control.waitMicros(readDelay - temp);
        }

        // Try a few times to get valid data...
        for (let RetryCnt = 0; RetryCnt < 5; RetryCnt++) {
            pins.digitalWritePin(DO, 1);
            pins.digitalWritePin(CLK, 1);
            pins.digitalWritePin(CS, 0);    // low enable joystick

            control.waitMicros(CTRL_BYTE_DELAY);
            //Send the command to send button and joystick data;
            for (let i = 0; i < 9; i++) {
                ps2Data[i] = inOutData(READ_DATA[i]);
            }

            pins.digitalWritePin(CS, 1);    // high disable joystick

            // Check to see if we received valid data or not.  
            // We should be in analog mode for our data to be valid (analog == 0x7_)
            if ((ps2Data[1] & 0xf0) == 0x70)
                break;

            // If we got to here, we are not in analog mode, try to recover...
            reconfigGamepad(); // try to get back into Analog mode.
            control.waitMicros(readDelay);
        }

        // If we get here and still not in analog mode (=0x7_), try increasing the readDelay...
        if ((ps2Data[1] & 0xf0) != 0x70) {
            if (readDelay < 10)
                readDelay++;   // see if this helps out...
        }

        btData = ps2Data[3] + (ps2Data[4] << 8);   // store digital button value

        lastReadtime = input.runningTime();
        return ((ps2Data[1] & 0xf0) == 0x70);  // 1 = OK = analog mode - 0 = NOK
    }

    /**
     * Config gamepad set it in analog mode
     */
    function reconfigGamepad() {
        sendCommand(ENTER_CONFIG);
        sendCommand(SET_ANALOGMODE);
        sendCommand(EXIT_CONFIG);
    }

    /**
    * Send command
    * @param {number[]} cmd - the command array, eg: ENTER_CONFIG
    */
    function sendCommand(cmd: number[]) {
        pins.digitalWritePin(CS, 0);    // low enable joystick
        for (let y = 0; y < cmd.length; y++) {
            inOutData(cmd[y]);
        }
        pins.digitalWritePin(CS, 1);    // high disable joystick
        control.waitMicros(readDelay);     //wait a few
    }

    /**
     * return ps2 controller's digital button's state.
     * @param {DigitalButton} button - digital button name, eg: ps2.DigitalButton.Select
     * @return {number} digital button's state
     */
    export function buttonDigital(button: DigitalButton): boolean {
        return ((~btData & button) > 0);
    }

    /**
     * return ps2 controller's analog button's value.
     * @param {AnalogButton} button - analog button name, eg: ps2.AnalogButton.RX
     * @return {number} analog button's value, range: 0~255, idle: 128
     */
    export function buttonAnalog(button: AnalogButton): number {
        return ps2Data[button];
    }
}