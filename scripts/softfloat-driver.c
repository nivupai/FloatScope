#include <stdio.h>
#include <stdint.h>
#include "softfloat.h"
int main(void) {
  unsigned a, b, op, c;
  softfloat_roundingMode = softfloat_round_near_even;
  softfloat_detectTininess = softfloat_tininess_afterRounding;
  while (scanf("%x %x %u %x", &a, &b, &op, &c) == 4) {
    float16_t x = { .v = (uint16_t)a }, y = { .v = (uint16_t)b };
    softfloat_exceptionFlags = 0;
    float16_t w = { .v = (uint16_t)c };
    float16_t z;
    switch (op) {
      case 0: z = f16_add(x, y); break;
      case 1: z = f16_sub(x, y); break;
      case 2: z = f16_mul(x, y); break;
      case 3: z = f16_mulAdd(x, y, w); break;
      default: return 2;
    }
    printf("%04x %u\n", (unsigned)z.v, (unsigned)softfloat_exceptionFlags);
  }
  return 0;
}
