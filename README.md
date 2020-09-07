# PS2 wireless controller

A driver of PS2 wireless controller in MakeCode.

## Example 

```typescript
// Read PS2 wireless controller and send button state to serial
serial.redirectToUSB();
serial.writeLine("hello");

ps2.initGamepad(DigitalPin.P15, DigitalPin.P14, DigitalPin.P13, DigitalPin.P16);

basic.forever(function () {

    ps2.readGamepad();
    if (ps2.buttonDigital(ps2.DigitalButton.Up)) {
        serial.writeString('Up');
    }
    else
        serial.writeString('None');
    
    serial.writeValue('RY', ps2.buttonAnalog(ps2.AnalogButton.RY));
    
    basic.pause(100);

})
```

## License

MIT

## Supported targets

* for PXT/microbit
(The metadata above is needed for package search.)

