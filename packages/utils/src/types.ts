/**
 * This file would hold all utility types that are used across the project.
 */

export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};
