#include <stdio.h>
#include <stdint.h>
#include "softfloat.h"
int main(void) {
  unsigned a, b, op;
  softfloat_roundingMode = softfloat_round_near_even;
  softfloat_detectTininess = softfloat_tininess_afterRounding;
  while (scanf("%x %x %u", &a, &b, &op) == 3) {
    float16_t x = { .v = (uint16_t)a }, y = { .v = (uint16_t)b };
    softfloat_exceptionFlags = 0;
    float16_t z = op ? f16_sub(x, y) : f16_add(x, y);
    printf("%04x %u\n", (unsigned)z.v, (unsigned)softfloat_exceptionFlags);
  }
  return 0;
}
