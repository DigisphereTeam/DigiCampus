import pool from "../config/database.js";
import { getCurrentDate } from "../utils/date.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const getAccountsDashboard = async (req, res) => {
  try {
    const academicYearResult = await pool.query(
      `SELECT academic_year_id, academic_year
       FROM tbl_academic_years
       WHERE is_current = true
       LIMIT 1`
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Current academic year not found"
      );
    }

    const { academic_year_id, academic_year } =
      academicYearResult.rows[0];

    const incomeResult = await pool.query(
      `SELECT
         COALESCE((
           SELECT SUM(amount)
           FROM tbl_fee_payments
           WHERE academic_year_id = $1
             AND is_active = true
         ), 0)
         +
         COALESCE((
           SELECT SUM(amount)
           FROM tbl_revenues
           WHERE academic_year_id = $1
             AND is_active = true
         ), 0) AS total_income,

         COALESCE((
           SELECT SUM(amount)
           FROM tbl_fee_payments
           WHERE academic_year_id = $1
             AND is_active = true
         ), 0) AS fee_revenue,

         COALESCE((
           SELECT SUM(amount)
           FROM tbl_revenues
           WHERE academic_year_id = $1
             AND is_active = true
         ), 0) AS other_revenue`,
      [academic_year_id]
    );

    const expenseResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses
       FROM tbl_expenses
       WHERE academic_year_id = $1
         AND is_active = true`,
      [academic_year_id]
    );

    const monthlyIncomeResult = await pool.query(
      `SELECT
         COALESCE((
           SELECT SUM(amount)
           FROM tbl_fee_payments
           WHERE academic_year_id = $1
             AND is_active = true
             AND DATE_TRUNC('month', payment_date) =
                 DATE_TRUNC('month', CURRENT_DATE)
         ), 0)
         +
         COALESCE((
           SELECT SUM(amount)
           FROM tbl_revenues
           WHERE academic_year_id = $1
             AND is_active = true
             AND DATE_TRUNC('month', revenue_date) =
                 DATE_TRUNC('month', CURRENT_DATE)
         ), 0) AS monthly_income,

         COALESCE((
           SELECT SUM(amount)
           FROM tbl_expenses
           WHERE academic_year_id = $1
             AND is_active = true
             AND DATE_TRUNC('month', expense_date) =
                 DATE_TRUNC('month', CURRENT_DATE)
         ), 0) AS monthly_expenses`,
      [academic_year_id]
    );

    const categoryResult = await pool.query(
      `SELECT
         ec.expense_category_id,
         ec.category_name,
         COALESCE(SUM(e.amount), 0) AS amount
       FROM tbl_expense_categories ec
       LEFT JOIN tbl_expenses e
         ON e.expense_category_id = ec.expense_category_id
        AND e.academic_year_id = $1
        AND e.is_active = true
       WHERE ec.is_active = true
       GROUP BY
         ec.expense_category_id,
         ec.category_name
       ORDER BY amount DESC`,
      [academic_year_id]
    );

    const recentTransactionsResult = await pool.query(
      `SELECT *
       FROM (
         SELECT
           fp.payment_date AS transaction_date,
           'INCOME' AS transaction_type,
           'STUDENT_FEES' AS category,
           fp.receipt_number AS reference_number,
           fp.amount,
           fp.payment_mode,
           fp.remarks AS description
         FROM tbl_fee_payments fp
         WHERE fp.academic_year_id = $1
           AND fp.is_active = true

         UNION ALL

         SELECT
           r.revenue_date AS transaction_date,
           'INCOME' AS transaction_type,
           rc.category_name AS category,
           r.receipt_number AS reference_number,
           r.amount,
           r.payment_mode,
           r.description
         FROM tbl_revenues r
         JOIN tbl_revenue_categories rc
           ON rc.revenue_category_id = r.revenue_category_id
         WHERE r.academic_year_id = $1
           AND r.is_active = true

         UNION ALL

         SELECT
           e.expense_date AS transaction_date,
           'EXPENSE' AS transaction_type,
           ec.category_name AS category,
           e.transaction_reference AS reference_number,
           e.amount,
           e.payment_mode,
           e.description
         FROM tbl_expenses e
         JOIN tbl_expense_categories ec
           ON ec.expense_category_id = e.expense_category_id
         WHERE e.academic_year_id = $1
           AND e.is_active = true
       ) transactions
       ORDER BY transaction_date DESC
       LIMIT 10`,
      [academic_year_id]
    );

    const totalIncome = Number(incomeResult.rows[0].total_income);
    const totalExpenses = Number(expenseResult.rows[0].total_expenses);

    return sendSuccessResponse(
      res,
      200,
      "Accounts dashboard fetched successfully",
      {
        academic_year_id,
        academic_year,
        summary: {
          total_income: totalIncome,
          fee_revenue: Number(incomeResult.rows[0].fee_revenue),
          other_revenue: Number(incomeResult.rows[0].other_revenue),
          total_expenses: totalExpenses,
          net_balance: totalIncome - totalExpenses,
          monthly_income: Number(
            monthlyIncomeResult.rows[0].monthly_income
          ),
          monthly_expenses: Number(
            monthlyIncomeResult.rows[0].monthly_expenses
          )
        },
        expense_categories: categoryResult.rows,
        recent_transactions: recentTransactionsResult.rows
      }
    );
  } catch (error) {
    console.log("Get accounts dashboard error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch accounts dashboard"
    );
  }
};

export const addExpense = async (req, res) => {
  try {
    const {
      expense_category_id,
      amount,
      expense_date,
      payment_mode,
      paid_from,
      transaction_reference,
      description
    } = req.body;

    const academicYearResult = await pool.query(
      `SELECT academic_year_id
       FROM tbl_academic_years
       WHERE is_current = true
       LIMIT 1`
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Current academic year not found"
      );
    }

    const academic_year_id =
      academicYearResult.rows[0].academic_year_id;

    const categoryResult = await pool.query(
      `SELECT expense_category_id
       FROM tbl_expense_categories
       WHERE expense_category_id = $1
         AND is_active = true`,
      [expense_category_id]
    );

    if (categoryResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Expense category with ID ${expense_category_id} not found`
      );
    }

    const receipt_file = req.file
      ? req.file.location || req.file.path
      : null;

    const result = await pool.query(
      `INSERT INTO tbl_expenses (
         academic_year_id,
         expense_category_id,
         amount,
         expense_date,
         payment_mode,
         paid_from,
         transaction_reference,
         description,
         receipt_file,
         added_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        academic_year_id,
        expense_category_id,
        amount,
        expense_date || getCurrentDate(),
        payment_mode,
        paid_from,
        transaction_reference || null,
        description || null,
        receipt_file,
        req.user.user_id
      ]
    );

    return sendSuccessResponse(
      res,
      201,
      "Expense added successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Add expense error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to add expense"
    );
  }
};

export const getExpenses = async (req, res) => {
  try {
    const {
      category_id,
      payment_mode,
      from_date,
      to_date,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const conditions = ["e.is_active = true"];
    const values = [];
    let parameterIndex = 1;

    if (category_id) {
      conditions.push(
        `e.expense_category_id = $${parameterIndex}`
      );
      values.push(category_id);
      parameterIndex++;
    }

    if (payment_mode) {
      conditions.push(
        `e.payment_mode = $${parameterIndex}`
      );
      values.push(payment_mode);
      parameterIndex++;
    }

    if (from_date) {
      conditions.push(
        `e.expense_date >= $${parameterIndex}`
      );
      values.push(from_date);
      parameterIndex++;
    }

    if (to_date) {
      conditions.push(
        `e.expense_date <= $${parameterIndex}`
      );
      values.push(to_date);
      parameterIndex++;
    }

    if (search) {
      conditions.push(
        `(ec.category_name ILIKE $${parameterIndex}
          OR e.description ILIKE $${parameterIndex}
          OR e.transaction_reference ILIKE $${parameterIndex})`
      );
      values.push(`%${search}%`);
      parameterIndex++;
    }

    const academicYearResult = await pool.query(
      `SELECT academic_year_id
       FROM tbl_academic_years
       WHERE is_current = true
       LIMIT 1`
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Current academic year not found"
      );
    }

    const academic_year_id =
      academicYearResult.rows[0].academic_year_id;

    conditions.push(
      `e.academic_year_id = $${parameterIndex}`
    );
    values.push(academic_year_id);
    parameterIndex++;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM tbl_expenses e
       JOIN tbl_expense_categories ec
         ON ec.expense_category_id = e.expense_category_id
       WHERE ${conditions.join(" AND ")}`,
      values
    );

    values.push(Number(limit));
    values.push(offset);

    const result = await pool.query(
      `SELECT
         e.expense_id,
         e.academic_year_id,
         e.expense_category_id,
         ec.category_name,
         e.amount,
         e.expense_date,
         e.payment_mode,
         e.paid_from,
         e.transaction_reference,
         e.description,
         e.receipt_file,
         e.added_by,
         u.full_name AS added_by_name,
         e.created_at
       FROM tbl_expenses e
       JOIN tbl_expense_categories ec
         ON ec.expense_category_id = e.expense_category_id
       LEFT JOIN tbl_users u
         ON u.user_id = e.added_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY e.expense_date DESC, e.expense_id DESC
       LIMIT $${parameterIndex}
       OFFSET $${parameterIndex + 1}`,
      values
    );

    return sendSuccessResponse(
      res,
      200,
      "Expenses fetched successfully",
      {
        data: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(countResult.rows[0].total),
          total_pages: Math.ceil(
            Number(countResult.rows[0].total) / Number(limit)
          )
        },
        filters: {
          category_id: category_id || null,
          payment_mode: payment_mode || null,
          from_date: from_date || null,
          to_date: to_date || null,
          search: search || "",
          page: Number(page),
          limit: Number(limit)
        }
      }
    );
  } catch (error) {
    console.log("Get expenses error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch expenses"
    );
  }
};

export const getExpenseById = async (req, res) => {
  try {
    const { expense_id } = req.params;

    if (!isValidId(expense_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid expense ID is required"
      );
    }

    const result = await pool.query(
      `SELECT
         e.expense_id,
         e.academic_year_id,
         e.expense_category_id,
         ec.category_name,
         e.amount,
         e.expense_date,
         e.payment_mode,
         e.paid_from,
         e.transaction_reference,
         e.description,
         e.receipt_file,
         e.added_by,
         u.full_name AS added_by_name,
         e.created_at,
         e.updated_at
       FROM tbl_expenses e
       JOIN tbl_expense_categories ec
         ON ec.expense_category_id = e.expense_category_id
       LEFT JOIN tbl_users u
         ON u.user_id = e.added_by
       WHERE e.expense_id = $1
         AND e.is_active = true`,
      [expense_id]
    );

    if (result.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Expense with ID ${expense_id} not found`
      );
    }

    return sendSuccessResponse(
      res,
      200,
      "Expense fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.log("Get expense by ID error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch expense"
    );
  }
};

export const getAccountTransactions = async (req, res) => {
  try {
    const {
      transaction_type,
      payment_mode,
      from_date,
      to_date,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const academicYearResult = await pool.query(
      `SELECT academic_year_id
       FROM tbl_academic_years
       WHERE is_current = true
       LIMIT 1`
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Current academic year not found"
      );
    }

    const academic_year_id =
      academicYearResult.rows[0].academic_year_id;

    const transactionsResult = await pool.query(
      `SELECT *
       FROM (
         SELECT
           fp.payment_id AS transaction_id,
           fp.payment_date AS transaction_date,
           'INCOME' AS transaction_type,
           'STUDENT_FEES' AS category,
           fp.receipt_number AS reference_number,
           fp.amount,
           fp.payment_mode,
           fp.remarks AS description
         FROM tbl_fee_payments fp
         WHERE fp.academic_year_id = $1
           AND fp.is_active = true

         UNION ALL

         SELECT
           r.revenue_id AS transaction_id,
           r.revenue_date AS transaction_date,
           'INCOME' AS transaction_type,
           rc.category_name AS category,
           r.receipt_number AS reference_number,
           r.amount,
           r.payment_mode,
           r.description
         FROM tbl_revenues r
         JOIN tbl_revenue_categories rc
           ON rc.revenue_category_id = r.revenue_category_id
         WHERE r.academic_year_id = $1
           AND r.is_active = true

         UNION ALL

         SELECT
           e.expense_id AS transaction_id,
           e.expense_date AS transaction_date,
           'EXPENSE' AS transaction_type,
           ec.category_name AS category,
           e.transaction_reference AS reference_number,
           e.amount,
           e.payment_mode,
           e.description
         FROM tbl_expenses e
         JOIN tbl_expense_categories ec
           ON ec.expense_category_id = e.expense_category_id
         WHERE e.academic_year_id = $1
           AND e.is_active = true
       ) transactions
       WHERE ($2::VARCHAR IS NULL OR transaction_type = $2)
         AND ($3::VARCHAR IS NULL OR payment_mode = $3)
         AND ($4::DATE IS NULL OR transaction_date >= $4)
         AND ($5::DATE IS NULL OR transaction_date <= $5)
         AND (
           $6::VARCHAR IS NULL
           OR category ILIKE '%' || $6 || '%'
           OR description ILIKE '%' || $6 || '%'
           OR reference_number ILIKE '%' || $6 || '%'
         )
       ORDER BY transaction_date DESC, transaction_id DESC
       LIMIT $7
       OFFSET $8`,
      [
        academic_year_id,
        transaction_type || null,
        payment_mode || null,
        from_date || null,
        to_date || null,
        search || null,
        Number(limit),
        (Number(page) - 1) * Number(limit)
      ]
    );

    return sendSuccessResponse(
      res,
      200,
      "Account transactions fetched successfully",
      {
        data: transactionsResult.rows,
        filters: {
          transaction_type: transaction_type || null,
          payment_mode: payment_mode || null,
          from_date: from_date || null,
          to_date: to_date || null,
          search: search || "",
          page: Number(page),
          limit: Number(limit)
        }
      }
    );
  } catch (error) {
    console.log("Get account transactions error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch account transactions"
    );
  }
};

export const getAccountReports = async (req, res) => {
  try {
    const {
      from_date,
      to_date,
      category_id,
      payment_mode
    } = req.query;

    const academicYearResult = await pool.query(
      `SELECT academic_year_id, academic_year
       FROM tbl_academic_years
       WHERE is_current = true
       LIMIT 1`
    );

    if (academicYearResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        "Current academic year not found"
      );
    }

    const {
      academic_year_id,
      academic_year
    } = academicYearResult.rows[0];

    const incomeResult = await pool.query(
      `SELECT
         COALESCE((
           SELECT SUM(fp.amount)
           FROM tbl_fee_payments fp
           WHERE fp.academic_year_id = $1
             AND fp.is_active = true
             AND ($2::DATE IS NULL OR fp.payment_date >= $2)
             AND ($3::DATE IS NULL OR fp.payment_date <= $3)
             AND ($4::VARCHAR IS NULL OR fp.payment_mode = $4)
         ), 0)
         +
         COALESCE((
           SELECT SUM(r.amount)
           FROM tbl_revenues r
           WHERE r.academic_year_id = $1
             AND r.is_active = true
             AND ($2::DATE IS NULL OR r.revenue_date >= $2)
             AND ($3::DATE IS NULL OR r.revenue_date <= $3)
             AND ($4::VARCHAR IS NULL OR r.payment_mode = $4)
         ), 0) AS total_income,

         COALESCE((
           SELECT SUM(fp.amount)
           FROM tbl_fee_payments fp
           WHERE fp.academic_year_id = $1
             AND fp.is_active = true
             AND ($2::DATE IS NULL OR fp.payment_date >= $2)
             AND ($3::DATE IS NULL OR fp.payment_date <= $3)
             AND ($4::VARCHAR IS NULL OR fp.payment_mode = $4)
         ), 0) AS fee_revenue,

         COALESCE((
           SELECT SUM(r.amount)
           FROM tbl_revenues r
           WHERE r.academic_year_id = $1
             AND r.is_active = true
             AND ($2::DATE IS NULL OR r.revenue_date >= $2)
             AND ($3::DATE IS NULL OR r.revenue_date <= $3)
             AND ($4::VARCHAR IS NULL OR r.payment_mode = $4)
         ), 0) AS other_revenue`,
      [
        academic_year_id,
        from_date || null,
        to_date || null,
        payment_mode || null
      ]
    );

    const expenseResult = await pool.query(
      `SELECT COALESCE(SUM(e.amount), 0) AS total_expenses
       FROM tbl_expenses e
       WHERE e.academic_year_id = $1
         AND e.is_active = true
         AND ($2::DATE IS NULL OR e.expense_date >= $2)
         AND ($3::DATE IS NULL OR e.expense_date <= $3)
         AND ($4::INTEGER IS NULL OR e.expense_category_id = $4)
         AND ($5::VARCHAR IS NULL OR e.payment_mode = $5)`,
      [
        academic_year_id,
        from_date || null,
        to_date || null,
        category_id || null,
        payment_mode || null
      ]
    );

    const expenseCategoryResult = await pool.query(
      `SELECT
         ec.expense_category_id,
         ec.category_name,
         COALESCE(SUM(e.amount), 0) AS amount
       FROM tbl_expense_categories ec
       LEFT JOIN tbl_expenses e
         ON e.expense_category_id = ec.expense_category_id
        AND e.academic_year_id = $1
        AND e.is_active = true
        AND ($2::DATE IS NULL OR e.expense_date >= $2)
        AND ($3::DATE IS NULL OR e.expense_date <= $3)
        AND ($4::VARCHAR IS NULL OR e.payment_mode = $4)
       WHERE ec.is_active = true
         AND ($5::INTEGER IS NULL
              OR ec.expense_category_id = $5)
       GROUP BY
         ec.expense_category_id,
         ec.category_name
       ORDER BY amount DESC`,
      [
        academic_year_id,
        from_date || null,
        to_date || null,
        payment_mode || null,
        category_id || null
      ]
    );

    const totalIncome = Number(
      incomeResult.rows[0].total_income
    );

    const totalExpenses = Number(
      expenseResult.rows[0].total_expenses
    );

    return sendSuccessResponse(
      res,
      200,
      "Account reports fetched successfully",
      {
        academic_year_id,
        academic_year,
        summary: {
          total_income: totalIncome,
          fee_revenue: Number(
            incomeResult.rows[0].fee_revenue
          ),
          other_revenue: Number(
            incomeResult.rows[0].other_revenue
          ),
          total_expenses: totalExpenses,
          net_balance: totalIncome - totalExpenses
        },
        expense_categories: expenseCategoryResult.rows,
        filters: {
          from_date: from_date || null,
          to_date: to_date || null,
          category_id: category_id || null,
          payment_mode: payment_mode || null
        }
      }
    );
  } catch (error) {
    console.log("Get account reports error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch account reports"
    );
  }
};