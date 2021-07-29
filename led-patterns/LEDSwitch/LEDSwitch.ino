//Baud rate: 57600
#define FASTLED_INTERNAL
#include <FastLED.h>

#define INPUT_SIZE 30

#define NUM_LEDS 10 //Make dynamic with setup from master device
#define COLOR_ORDER GRB
#define DATA_PIN 7
CRGB leds[NUM_LEDS]; // Define the array of leds
CRGB colorBlank = CRGB(0, 0, 0);

//LED Pattern Variables
char patternMain = 'b'; //Main pattern choice: a=Rev,
char patternSub = 'c';  //Sub pattern choice

int kittDirection = 0; // Direction of lights, 0 or 1
int kittCounter = 0;   // Current spot in in strip of leds

//---LED Functions
void resetAll() //Set all lets to black(nothing)
{
  for (int i = 0; i < NUM_LEDS; i++)
  {
    leds[i] = colorBlank;
  }
  FastLED.show();
};
void fadeAll() //Gradually fade all light
{
  for (int i = 0; i < NUM_LEDS; i++)
  {
    leds[i].nscale8(6500);
  }
};

//---Serial Functions

//! TESTING
int testCount = 0;
void generateFakeRPMs()
{
  if (testCount == 0)
  {
    testCount += 1;
  }
  else if (testCount == NUM_LEDS)
  {
    testCount -= 1;
  }
  else
  {
    if (random(0, 2))
    {
      testCount += 1;
    }
    else
    {
      testCount -= 1;
    }
  }
}

void setup()
{
  LEDS.setBrightness(25);                                          //Set LED Brightness, make dynamic with setup from master device
  FastLED.addLeds<WS2812B, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS); //FastLED setup

  Serial.begin(57600); // Serial communication to receive commands to change pattern
}

void receiveSerial()
{
  if (Serial.available() > 0)
  {
    char input[INPUT_SIZE + 1];
    byte size = Serial.readBytes(input, INPUT_SIZE);
    input[size] = 0;

    char *command = strtok(input, "&");
    while (command != 0)
    {
      char *value = strchr(command, '=');
      if (value != 0)
      {
        *value = 0;
        ++value;
        char arg = command[0];
        char val = value[0];
        switch (arg)
        {
        case 'a':
          patternMain = val;
          Serial.println("{\"status\": 200}");
          break;

        case 'b':
          patternSub = val;
          Serial.println("{\"status\": 200}");
          break;

        default:
          Serial.println("{\"status\": 500}");
          break;
        }
      }
      command = strtok(0, "&");
    }
  }
}

void loop()
{

  //! TESTING TESTING TESTING TESTING TESTING TESTING
  generateFakeRPMs();
  //! TESTING TESTING TESTING TESTING TESTING TESTING

  // float TESTInputRevs = random(0, NUM_LEDS); //! REPLACE WITH REV READING

  switch (patternMain)
  {
  case 'a': //Rev Patterns
  {
    for (int i = 0; i < NUM_LEDS; i++) // Loop through each LED in strip
    {
      float stripProgress = (float)i / (float)NUM_LEDS;
      float perc = (float)testCount / (float)NUM_LEDS; //Percentage of lights that should be lit
      int numToLight = NUM_LEDS * perc;                //Int of final light that should be lit

      CRGB revColor1 = CRGB(0, 255, 0);
      float cutOff1 = .4;
      CRGB revColor2 = CRGB(200, 255, 0);
      float cutOff2 = .6;
      CRGB revColor3 = CRGB(255, 150, 0);
      float cutOff3 = .8;
      CRGB revColor4 = CRGB(255, 0, 0);
      CRGB revColorCustom = CRGB(255, 255, 255);

      switch (patternSub)
      {
      case 'a': //Fill - SingleColor
        if (i < numToLight)
        {

          leds[i] = revColorCustom;
        }
        else
        {
          leds[i] = colorBlank;
        }
        break;
      case 'b': // Fill - ColorChange
        if (i < numToLight)
        {
          if (perc < cutOff1)
          {
            leds[i] = revColor1;
          }
          else if (perc < cutOff2)
          {
            leds[i] = revColor2;
          }
          else if (perc < cutOff3)
          {
            leds[i] = revColor3;
          }
          else
          {
            leds[i] = revColor4;
          }
        }
        else
        {
          leds[i] = colorBlank; //Reset unused LEDs
        }
        break;
      case 'c': // Fill - MultiColor
        if (i < numToLight)
        {
          if (stripProgress < cutOff1)
          {
            leds[i] = revColor1;
          }
          else if (stripProgress < cutOff2)
          {
            leds[i] = revColor2;
          }
          else if (stripProgress < cutOff3)
          {
            leds[i] = revColor3;
          }
          else
          {
            leds[i] = revColor4;
          }
        }
        else
        {
          leds[i] = colorBlank; //Reset unused LEDs
        }
        break;
      case 'z':
        delay(250);
        break;
      default:
        resetAll();
        patternSub = 'z';
        break;
      }
    }
    FastLED.show();
    delay(250);
    break;
  }
  case 'b': // Turn Signal Patterns
    for (int i = 0; i < NUM_LEDS; i++)
    {
      fadeAll();
      leds[i] = CRGB(255, 175, 0);
      FastLED.show();
      delay(125);
    }
    break;
  case 'c': // Kitt Patterns
  {
    kittDirection ? kittCounter-- : kittCounter++;
    fadeAll();
    if (kittCounter == NUM_LEDS - 1)
      kittDirection = 1;
    if (kittCounter == 0)
      kittDirection = 0;
    leds[kittCounter] = CRGB(255, 0, 0);
    FastLED.show();
    delay(115);
    break;
  }

  default:
    resetAll();
    patternMain = 'z';
    break;
  }

  receiveSerial();

  // Serial.print("{");
  // String keyNumLED = "\"numLed\": ";
  // Serial.print(keyNumLED + NUM_LEDS);
  // Serial.print(",");
  // String keyLEDOnCount = "\"testCount\": ";
  // Serial.print(keyLEDOnCount + testCount);
  // Serial.println("}");
}
