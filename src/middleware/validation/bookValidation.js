import { hasValue } from "../../utils/validation.js";

export const validateCreateBook = (req, res, next) => {
  const {
    title,
    author,
    category,
    total_copies,
    available_copies,
  } = req.body || {};

  const trimmedTitle = typeof title === "string" ? title.trim() : title;
  const trimmedAuthor = typeof author === "string" ? author.trim() : author;
  const trimmedCategory =
    typeof category === "string" ? category.trim() : category;

  if (!hasValue(trimmedTitle)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Title is required",
    });
  }

  if (!hasValue(trimmedAuthor)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Author is required",
    });
  }

  if (!hasValue(total_copies)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Total copies are required",
    });
  }

  const totalCopies = Number(total_copies);

  if (!Number.isInteger(totalCopies) || totalCopies < 1) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Total copies must be a positive integer",
    });
  }

  let availableCopies = available_copies;

  if (hasValue(availableCopies)) {
    availableCopies = Number(availableCopies);

    if (!Number.isInteger(availableCopies) || availableCopies < 0) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Available copies must be a non-negative integer",
      });
    }

    if (availableCopies > totalCopies) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Available copies cannot be greater than total copies",
      });
    }
  } else {
    availableCopies = totalCopies;
  }

  req.body.title = trimmedTitle;
  req.body.author = trimmedAuthor;
  req.body.category = hasValue(trimmedCategory)
    ? trimmedCategory
    : null;
  req.body.total_copies = totalCopies;
  req.body.available_copies = availableCopies;

  next();
};

export const validateUpdateBook = (req, res, next) => {
  const {
    title,
    author,
    category,
    total_copies,
    available_copies,
    is_active,
  } = req.body;

  if (
    title === undefined &&
    author === undefined &&
    category === undefined &&
    total_copies === undefined &&
    available_copies === undefined &&
    is_active === undefined
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "At least one field is required to update",
    });
  }

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid title is required",
      });
    }

    req.body.title = title.trim();
  }

  if (author !== undefined) {
    if (typeof author !== "string" || !author.trim()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Valid author is required",
      });
    }

    req.body.author = author.trim();
  }

  if (category !== undefined) {
    if (category !== null && typeof category !== "string") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Category must be a string",
      });
    }

    req.body.category =
      category === null ? null : category.trim();
  }

  if (total_copies !== undefined) {
    const totalCopies = Number(total_copies);

    if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Total copies must be a positive integer",
      });
    }

    req.body.total_copies = totalCopies;
  }

  if (available_copies !== undefined) {
    const availableCopies = Number(available_copies);

    if (!Number.isInteger(availableCopies) || availableCopies < 0) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Available copies must be a non-negative integer",
      });
    }

    req.body.available_copies = availableCopies;
  }

  if (is_active !== undefined) {
    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "is_active must be a boolean",
      });
    }

    req.body.is_active = is_active;
  }

  if (
    total_copies !== undefined &&
    available_copies !== undefined &&
    Number(available_copies) > Number(total_copies)
  ) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Available copies cannot be greater than total copies",
    });
  }

  next();
};

