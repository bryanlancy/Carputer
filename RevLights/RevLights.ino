#include <FastLED.h>
#define NUM_LEDS 10
#define COLOR_ORDER GRB 
#define DATA_PIN 7

CRGB leds[NUM_LEDS]; // Define the array of leds

void setup() { 
  FastLED.addLeds<WS2812B, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  LEDS.setBrightness(25);
  Serial.begin(9600);
}
void fadeall() { for(int i = 0; i < NUM_LEDS; i++) { leds[i].nscale8(100); } };
void loop() {
  float pot = analogRead(A0);
  float perc = pot / 1023;
  int numToLight = NUM_LEDS * perc;
  fadeall();

  for (int i = 0; i < numToLight; i++) {
    float curper = (i + 1) / numToLight;
    leds[i] = CRGB::Red;
    Serial.println(curper);
  }
  
  FastLED.show();
}
