export const phoneRegex = /^[6-9]\d{9}$/;

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidId = (id) => {
  const numericId = Number(id);
  return Number.isSafeInteger(numericId) && numericId > 0;
};

export const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";