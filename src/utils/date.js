const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDate = (value) => {
  if (
    typeof value !== "string" ||
    !DATE_REGEX.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const getCurrentDate = () => {
  return new Date().toLocaleDateString(
    "en-CA",
    {
      timeZone: "Asia/Kolkata"
    }
  );
};
