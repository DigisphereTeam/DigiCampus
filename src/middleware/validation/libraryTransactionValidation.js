import { isValidId } from "../../utils/validation.js";

export const validateIssueBook = (req, res, next) => {
  let {
    book_id,
    student_id,
    issue_date,
    due_date,
    remarks,
  } = req.body;

  if (
    book_id === undefined ||
    book_id === null ||
    book_id === ""
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Book ID is required",
    });
  }

  if (!isValidId(book_id)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Valid book ID is required",
    });
  }

  if (
    student_id === undefined ||
    student_id === null ||
    student_id === ""
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Student ID is required",
    });
  }

  if (!isValidId(student_id)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Valid student ID is required",
    });
  }

  if (
    due_date === undefined ||
    due_date === null ||
    due_date === ""
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Due date is required",
    });
  }

  book_id = Number(book_id);
  student_id = Number(student_id);

  issue_date =
    issue_date !== undefined &&
      issue_date !== null &&
      issue_date !== ""
      ? issue_date.trim()
      : null;

  due_date = due_date.trim();

  remarks =
    remarks !== undefined &&
      remarks !== null &&
      remarks !== ""
      ? remarks.trim()
      : null;

  req.body = {
    book_id,
    student_id,
    issue_date,
    due_date,
    remarks,
  };

  next();
};

export const validateReturnBook = (req, _, next) => {
  let {
    return_date,
    remarks,
  } = req.body;

  return_date =
    return_date !== undefined &&
      return_date !== null &&
      return_date !== ""
      ? return_date.trim()
      : null;

  remarks =
    remarks !== undefined &&
      remarks !== null &&
      remarks !== ""
      ? remarks.trim()
      : null;

  req.body = {
    return_date,
    remarks,
  };

  next();
};