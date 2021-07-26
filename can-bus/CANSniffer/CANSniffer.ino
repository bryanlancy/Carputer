#include <Canbus.h>  // don't forget to include these
#include <defaults.h>
#include <global.h>
#include <mcp2515.h>
#include <mcp2515_defs.h>

void setup()
{
  Serial.begin(9600);
  //Initialise MCP2515 CAN controller at the specified speed
  if (Canbus.init(CANSPEED_500))
    Serial.println("CAN Init ok");
  else
    Serial.println("Can't Init CAN");

  delay(1000);
}

void loop() {

  tCAN message;
  if (mcp2515_check_message())
  {
    if (mcp2515_get_message(&message))
    {
      //if(message.id == 0x620 and message.data[2] == 0xFF)  //uncomment when you want to filter
      //{

      Serial.print("ID: ");
      Serial.print(message.id, HEX);
      Serial.print(", ");
      Serial.print("Data(" + message.header.length + "): ");
      for (int i = 0; i < message.header.length; i++)
      {
        Serial.print(message.data[i], HEX);
        Serial.print(" ");
      }
      Serial.println("");
      //}
    }
  }

}
