#include <FastLED.h>
#define NUM_LEDS 10
#define COLOR_ORDER GRB 
#define DATA_PIN 7

CRGB leds[NUM_LEDS]; // Define the array of leds
int direction1 = 0; // Direction of lights, 0 or 1
int counter = 0; // Current spot in in strip of leds

void setup() { 
  FastLED.addLeds<WS2812B, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  LEDS.setBrightness(25);
}
void fadeall() { for(int i = 0; i < NUM_LEDS; i++) { leds[i].nscale8(6500); } }
void loop() {
  direction1 ? counter-- : counter++;
  fadeall();
  if (counter == NUM_LEDS - 1) direction1 = 1;
  if (counter == 0) direction1 = 0;
  leds[counter] = CRGB::Red;
  FastLED.show();
  delay(115);
}
