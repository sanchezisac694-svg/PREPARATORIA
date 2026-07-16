export const accountStatuses = Object.freeze({
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
  DISABLED: "DISABLED",
  PENDING_ACTIVATION: "PENDING_ACTIVATION",
  PENDING_INVITATION: "PENDING_INVITATION",
  SUSPENDED: "SUSPENDED",
} as const);

export type AccountStatus = (typeof accountStatuses)[keyof typeof accountStatuses];

export const accountStatusValues = Object.freeze(
  Object.values(accountStatuses),
) as readonly AccountStatus[];

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === "string" && accountStatusValues.some((status) => status === value);
}

export const accountStatusTransitions = Object.freeze({
  [accountStatuses.PENDING_INVITATION]: Object.freeze([
    accountStatuses.PENDING_ACTIVATION,
    accountStatuses.DISABLED,
  ]),
  [accountStatuses.PENDING_ACTIVATION]: Object.freeze([
    accountStatuses.ACTIVE,
    accountStatuses.BLOCKED,
    accountStatuses.DISABLED,
  ]),
  [accountStatuses.ACTIVE]: Object.freeze([
    accountStatuses.SUSPENDED,
    accountStatuses.BLOCKED,
    accountStatuses.DISABLED,
  ]),
  [accountStatuses.SUSPENDED]: Object.freeze([
    accountStatuses.ACTIVE,
    accountStatuses.BLOCKED,
    accountStatuses.DISABLED,
  ]),
  [accountStatuses.BLOCKED]: Object.freeze([
    accountStatuses.ACTIVE,
    accountStatuses.SUSPENDED,
    accountStatuses.DISABLED,
  ]),
  [accountStatuses.DISABLED]: Object.freeze([
    accountStatuses.PENDING_ACTIVATION,
    accountStatuses.ACTIVE,
  ]),
}) satisfies Readonly<Record<AccountStatus, readonly AccountStatus[]>>;

export function canTransitionAccountStatus(from: AccountStatus, to: AccountStatus): boolean;
export function canTransitionAccountStatus(from: unknown, to: unknown): boolean;
export function canTransitionAccountStatus(from: unknown, to: unknown): boolean {
  if (!isAccountStatus(from) || !isAccountStatus(to)) {
    return false;
  }
  const allowedTransitions: readonly AccountStatus[] = accountStatusTransitions[from];
  return allowedTransitions.includes(to);
}
