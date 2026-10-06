import { sendErrorResponse } from "../../utils/response.js";
import { hasValue } from "../../utils/validation.js";

export const validateAssignFeeToStudent = (req, res, next) => {
  const {
    student_id,
    academic_year_id,
    fee_items,
    installments
  } = req.body;

  if (!hasValue(student_id)) {
    return sendErrorResponse(
      res,
      400,
      "Student ID is required"
    );
  }

  if (!hasValue(academic_year_id)) {
    return sendErrorResponse(
      res,
      400,
      "Academic year ID is required"
    );
  }

  if (!Array.isArray(fee_items) || fee_items.length === 0) {
    return sendErrorResponse(
      res,
      400,
      "Fee items are required"
    );
  }

  for (const item of fee_items) {
    if (!hasValue(item.fee_category_id)) {
      return sendErrorResponse(
        res,
        400,
        "Fee category ID is required"
      );
    }

    if (!hasValue(item.standard_amount)) {
      return sendErrorResponse(
        res,
        400,
        "Standard amount is required"
      );
    }

    if (
      Number.isNaN(Number(item.standard_amount)) ||
      Number(item.standard_amount) < 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid standard amount is required"
      );
    }

    if (
      hasValue(item.discount_amount) &&
      (
        Number.isNaN(Number(item.discount_amount)) ||
        Number(item.discount_amount) < 0
      )
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid discount amount is required"
      );
    }
  }

  if (!Array.isArray(installments) || installments.length === 0) {
    return sendErrorResponse(
      res,
      400,
      "Installments are required"
    );
  }

  for (const installment of installments) {
    if (!hasValue(installment.installment_number)) {
      return sendErrorResponse(
        res,
        400,
        "Installment number is required"
      );
    }

    if (!hasValue(installment.due_date)) {
      return sendErrorResponse(
        res,
        400,
        "Installment due date is required"
      );
    }

    if (!hasValue(installment.amount)) {
      return sendErrorResponse(
        res,
        400,
        "Installment amount is required"
      );
    }

    if (
      Number.isNaN(Number(installment.amount)) ||
      Number(installment.amount) <= 0
    ) {
      return sendErrorResponse(
        res,
        400,
        "Valid installment amount is required"
      );
    }
  }

  req.body.student_id = Number(student_id);
  req.body.academic_year_id = Number(academic_year_id);

  return next();
};

export const validateAddFeePayment = (req, res, next) => {
  const {
    student_id,
    student_fee_id,
    installment_id,
    amount,
    payment_date,
    payment_mode,
    transaction_reference,
    remarks
  } = req.body;

  if (!hasValue(student_id)) {
    return sendErrorResponse(
      res,
      400,
      "Student ID is required"
    );
  }

  if (!hasValue(student_fee_id)) {
    return sendErrorResponse(
      res,
      400,
      "Student fee ID is required"
    );
  }

  if (
    hasValue(installment_id) &&
    (
      Number.isNaN(Number(installment_id)) ||
      Number(installment_id) <= 0
    )
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid installment ID is required"
    );
  }

  if (!hasValue(amount)) {
    return sendErrorResponse(
      res,
      400,
      "Payment amount is required"
    );
  }

  if (
    Number.isNaN(Number(amount)) ||
    Number(amount) <= 0
  ) {
    return sendErrorResponse(
      res,
      400,
      "Valid payment amount is required"
    );
  }

  if (!hasValue(payment_date)) {
    return sendErrorResponse(
      res,
      400,
      "Payment date is required"
    );
  }

  if (!hasValue(payment_mode)) {
    return sendErrorResponse(
      res,
      400,
      "Payment mode is required"
    );
  }

  const allowedPaymentModes = [
    "CASH",
    "UPI",
    "BANK_TRANSFER",
    "ONLINE"
  ];

  if (!allowedPaymentModes.includes(payment_mode)) {
    return sendErrorResponse(
      res,
      400,
      "Valid payment mode is required"
    );
  }

  if (
    hasValue(transaction_reference) &&
    typeof transaction_reference !== "string"
  ) {
    return sendErrorResponse(
      res,
      400,
      "Transaction reference must be a string"
    );
  }

  if (
    hasValue(remarks) &&
    typeof remarks !== "string"
  ) {
    return sendErrorResponse(
      res,
      400,
      "Remarks must be a string"
    );
  }

  if (!req.file) {
    return sendErrorResponse(
      res,
      400,
      "Payment receipt is required"
    );
  }

  req.body.student_id = Number(student_id);
  req.body.student_fee_id = Number(student_fee_id);
  req.body.installment_id = hasValue(installment_id)
    ? Number(installment_id)
    : null;
  req.body.amount = Number(amount);

  if (typeof transaction_reference === "string") {
    req.body.transaction_reference =
      transaction_reference.trim();
  }

  if (typeof remarks === "string") {
    req.body.remarks = remarks.trim();
  }

  return next();
};