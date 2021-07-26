#include <FastLED.h>
#define NUM_LEDS 10
#define COLOR_ORDER GRB
#define DATA_PIN 7

CRGB leds[NUM_LEDS];         // Define the array of leds
int direction1 = 0;          // Direction of lights, 0 or 1
int direction2 = 1;          // Direction of lights, 0 or 1
int counter1 = 0;            // Current spot in in strip of leds
int counter2 = NUM_LEDS - 1; // Current spot in in strip of leds

void setup()
{
  FastLED.addLeds<WS2812B, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  LEDS.setBrightness(10);
}
void fadeall()
{
  for (int i = 0; i < NUM_LEDS; i++)
  {
    leds[i].nscale8(6500);
  }
}
void loop()
{
  fadeall();
  direction1 ? counter1-- : counter1++;
  direction2 ? counter2-- : counter2++;
  if (counter1 == NUM_LEDS - 1)
    direction1 = 1;
  if (counter1 == 0)
    direction1 = 0;
  if (counter2 == NUM_LEDS - 1)
    direction2 = 1;
  if (counter2 == 0)
    direction2 = 0;
  leds[counter1] = CRGB::Silver;
  leds[counter2] = CRGB::Gold;
  FastLED.show();
  delay(150);
}
