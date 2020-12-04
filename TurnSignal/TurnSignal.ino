#include <FastLED.h>
//number of LEDs
#define NUM_LEDS 10
#define COLOR_ORDER GRB
#define DATA_PIN 7
CRGB leds [NUM_LEDS];

void setup() {
  FastLED.addLeds<WS2812B, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  LEDS.setBrightness(84);
}
void fadeall() { for(int i = 0; i < NUM_LEDS; i++) { leds[i].nscale8(4000); } }
void loop() {
  for (int i = 0; i < NUM_LEDS; i++){
    fadeall();
    leds[i] = CRGB::OrangeRed;
    FastLED.show();
    delay(125);
  }
}
