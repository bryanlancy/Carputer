//Baud rate: 57600

#define FASTLED_INTERNAL
#include <FastLED.h>
#include <SerialCommands.h>

#define NUM_LEDS 10 //Make dynamic with setup from master device
#define COLOR_ORDER GRB
#define DATA_PIN 7
CRGB leds[NUM_LEDS]; // Define the array of leds
CRGB colorBlank = CRGB(0, 0, 0);

char serial_command_buffer_[32];
SerialCommands serial_commands_(&Serial, serial_command_buffer_, sizeof(serial_command_buffer_), "\r\n", " ");

int kittDirection = 0; // Direction of lights, 0 or 1
int kittCounter = 0;   // Current spot in in strip of leds

int testCount = 0;
char patternMain = 'a'; //Main pattern choice: a=Rev,
char patternSub = 'c';  //Sub pattern choice

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

//Template for command w/ args
void cmd_WithArgs(SerialCommands *sender)
{
  char *arg = sender->Next();
  if (arg == NULL)
  {
    sender->GetSerial()->println("ERROR No Arguments");
    return;
  }
  sender->GetSerial()->println(arg);
  while ((arg = sender->Next()) != NULL)
  {
    sender->GetSerial()->println(arg);
    sender->GetSerial()->println("TEST from arduino!");
  }
};
//default command, command not found
void cmd_unrecognized(SerialCommands *sender, const char *cmd)
{
  sender->GetSerial()->print("ERROR: Unrecognized command [");
  sender->GetSerial()->print(cmd);
  sender->GetSerial()->println("]");
};
//Set Main Pattern command
void cmd_setPatternMain(SerialCommands *sender)
{
  char *arg = sender->Next();
  if (arg == NULL)
  {
    sender->GetSerial()->println("ERROR No Arguments");
    return;
  }
  patternMain = arg[0];
  sender->GetSerial()->println(arg);
};
void cmd_setPatternSub(SerialCommands *sender)
{
  char *arg = sender->Next();
  if (arg == NULL)
  {
    sender->GetSerial()->println("ERROR No Arguments");
    return;
  }

  patternSub = arg[0];
  sender->GetSerial()->println(arg);
};

SerialCommand cmd_setPatternMain_("patternMain", cmd_setPatternMain);
SerialCommand cmd_setPatternSub_("patternSub", cmd_setPatternSub);

void setup()
{
  LEDS.setBrightness(25);
  FastLED.addLeds<WS2812B, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS); //FastLED setup

  Serial.begin(57600);                                   // Serial communication to receive commands to change pattern
  serial_commands_.SetDefaultHandler(&cmd_unrecognized); //Set LED Brightness, make dynamic with setup from master device
  serial_commands_.AddCommand(&cmd_setPatternMain_);
  serial_commands_.AddCommand(&cmd_setPatternSub_);
}

void loop()
{

  //! TESTING TESTING TESTING TESTING TESTING TESTING
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
  //! TESTING TESTING TESTING TESTING TESTING TESTING

  serial_commands_.ReadSerial();
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
      CRGB revColorCustom = CRGB(255, 0, 255);

      switch (patternSub)
      {
      case 'a':
        if (i < numToLight)
        {

          leds[i] = revColorCustom;
        }
        else
        {
          leds[i] = colorBlank;
        }
        break;
      case 'b': // Fill - Color Change
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
      case 'c': // Fill - Multi-Color
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
      case NULL:
        delay(250);
        break;
      default:
        resetAll();
        patternSub = NULL;
        break;
      }
    }
    FastLED.show();
    delay(300);
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
  case NULL:
    delay(250);
    break;
  default:
    resetAll();
    patternMain = NULL;
    break;
  }
}
