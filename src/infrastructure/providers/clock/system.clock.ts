import { IClock } from '../../../domain/common/providers/clock.provider';

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
