export const technicalErrorCodes = {
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  TECHNICAL_ERROR: "TECHNICAL_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type TechnicalErrorCode = (typeof technicalErrorCodes)[keyof typeof technicalErrorCodes];
