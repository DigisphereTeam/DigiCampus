import pool from "../config/database.js";
import {
  sendErrorResponse,
  sendSuccessResponse
} from "../utils/response.js";
import { isValidId } from "../utils/validation.js";

export const getFeeSummary = async (req, res) => {
  try {
    const { academic_year_id } = req.query;

    const result = await pool.query(
      `
      SELECT
        c.class_id,
        c.class_name,
        COUNT(DISTINCT scs.student_id) AS total_students,
        COALESCE(SUM(sf.payable_amount), 0) AS total_payable,
        COALESCE(SUM(sf.paid_amount), 0) AS total_collected,
        COALESCE(
          SUM(sf.payable_amount - sf.paid_amount),
          0
        ) AS total_pending,
        COALESCE(
          SUM(
            CASE
              WHEN sf.due_date < CURRENT_DATE
              THEN sf.payable_amount - sf.paid_amount
              ELSE 0
            END
          ),
          0
        ) AS total_overdue
      FROM tbl_classes c
      LEFT JOIN tbl_class_sections cs
        ON cs.class_id = c.class_id
      LEFT JOIN tbl_student_class_sections scs
        ON scs.class_section_id = cs.class_section_id
        AND scs.is_active = true
      LEFT JOIN tbl_student_fees sf
        ON sf.student_id = scs.student_id
        AND sf.academic_year_id = $1
        AND sf.is_active = true
      WHERE c.is_active = true
      GROUP BY c.class_id, c.class_name
      ORDER BY c.class_name
      `,
      [academic_year_id]
    );

    const totals = await pool.query(
      `
      SELECT
        COUNT(DISTINCT student_id) AS total_students,
        COALESCE(SUM(payable_amount), 0) AS total_payable,
        COALESCE(SUM(paid_amount), 0) AS total_collected,
        COALESCE(
          SUM(payable_amount - paid_amount),
          0
        ) AS total_pending
      FROM tbl_student_fees
      WHERE academic_year_id = $1
        AND is_active = true
      `,
      [academic_year_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Fee summary fetched successfully",
      {
        summary: totals.rows[0],
        classes: result.rows
      }
    );
  } catch (error) {
    console.log("Get fee summary error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch fee summary"
    );
  }
};

export const getClassFeeDetails = async (req, res) => {
  try {
    const { class_id } = req.params;
    const { academic_year_id } = req.query;

    if (!isValidId(class_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid class ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        s.student_id,
        s.admission_number,
        s.full_name,
        sec.section_name,
        COALESCE(sf.payable_amount, 0) AS payable_amount,
        COALESCE(sf.paid_amount, 0) AS paid_amount,
        COALESCE(
          sf.payable_amount - sf.paid_amount,
          0
        ) AS balance,
        CASE
          WHEN COALESCE(sf.paid_amount, 0) >=
               COALESCE(sf.payable_amount, 0)
            THEN 'PAID'
          WHEN COALESCE(sf.paid_amount, 0) > 0
            THEN 'PARTIAL'
          ELSE 'PENDING'
        END AS status
      FROM tbl_students s
      INNER JOIN tbl_student_class_sections scs
        ON scs.student_id = s.student_id
        AND scs.is_active = true
      INNER JOIN tbl_class_sections cs
        ON cs.class_section_id = scs.class_section_id
      INNER JOIN tbl_sections sec
        ON sec.section_id = cs.section_id
      LEFT JOIN tbl_student_fees sf
        ON sf.student_id = s.student_id
        AND sf.academic_year_id = $2
        AND sf.is_active = true
      WHERE cs.class_id = $1
      ORDER BY s.full_name
      `,
      [class_id, academic_year_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Class fee details fetched successfully",
      result.rows
    );
  } catch (error) {
    console.log("Get class fee details error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch class fee details"
    );
  }
};

export const getStudentFeeDetails = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { academic_year_id } = req.query;

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    const studentResult = await pool.query(
      `
      SELECT
        s.student_id,
        s.admission_number,
        s.full_name,
        c.class_name,
        sec.section_name
      FROM tbl_students s
      LEFT JOIN tbl_student_class_sections scs
        ON scs.student_id = s.student_id
        AND scs.is_active = true
      LEFT JOIN tbl_class_sections cs
        ON cs.class_section_id = scs.class_section_id
      LEFT JOIN tbl_classes c
        ON c.class_id = cs.class_id
      LEFT JOIN tbl_sections sec
        ON sec.section_id = cs.section_id
      WHERE s.student_id = $1
      `,
      [student_id]
    );

    if (studentResult.rows.length === 0) {
      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`
      );
    }

    const feeResult = await pool.query(
      `
      SELECT
        sf.student_fee_id,
        sf.standard_amount,
        sf.discount_amount,
        sf.payable_amount,
        sf.paid_amount,
        sf.due_date,
        sf.status
      FROM tbl_student_fees sf
      WHERE sf.student_id = $1
        AND sf.academic_year_id = $2
        AND sf.is_active = true
      ORDER BY sf.student_fee_id DESC
      `,
      [student_id, academic_year_id]
    );

    const itemsResult = await pool.query(
      `
      SELECT
        sfi.student_fee_item_id,
        fc.fee_type,
        sfi.standard_amount,
        sfi.discount_amount,
        sfi.payable_amount,
        sfi.paid_amount,
        (
          sfi.payable_amount - sfi.paid_amount
        ) AS balance
      FROM tbl_student_fee_items sfi
      INNER JOIN tbl_fee_categories fc
        ON fc.fee_category_id = sfi.fee_category_id
      INNER JOIN tbl_student_fees sf
        ON sf.student_fee_id = sfi.student_fee_id
      WHERE sf.student_id = $1
        AND sf.academic_year_id = $2
        AND sf.is_active = true
      ORDER BY sfi.student_fee_item_id
      `,
      [student_id, academic_year_id]
    );

    const installmentsResult = await pool.query(
      `
      SELECT
        installment_id,
        installment_number,
        due_date,
        amount,
        paid_amount,
        (amount - paid_amount) AS balance,
        status
      FROM tbl_fee_installments
      WHERE student_id = $1
        AND academic_year_id = $2
        AND is_active = true
      ORDER BY installment_number
      `,
      [student_id, academic_year_id]
    );

    const paymentResult = await pool.query(
      `
      SELECT
        fp.payment_id,
        fp.receipt_number,
        fp.payment_date,
        fp.amount,
        fp.payment_mode,
        fp.transaction_reference,
        fp.receipt_file,
        fp.remarks
      FROM tbl_fee_payments fp
      WHERE fp.student_id = $1
        AND fp.academic_year_id = $2
        AND fp.is_active = true
      ORDER BY fp.payment_date DESC, fp.payment_id DESC
      `,
      [student_id, academic_year_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Student fee details fetched successfully",
      {
        student: studentResult.rows[0],
        fees: feeResult.rows,
        fee_items: itemsResult.rows,
        installments: installmentsResult.rows,
        payments: paymentResult.rows
      }
    );
  } catch (error) {
    console.log("Get student fee details error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch student fee details"
    );
  }
};

export const assignFeeToStudent = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      student_id,
      academic_year_id,
      fee_items,
      installments
    } = req.body;

    await client.query("BEGIN");

    const studentResult = await client.query(
      `
      SELECT student_id
      FROM tbl_students
      WHERE student_id = $1
        AND is_active = true
      `,
      [student_id]
    );

    if (studentResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        `Student with ID ${student_id} not found`
      );
    }

    const standardAmount = fee_items.reduce(
      (total, item) => total + Number(item.standard_amount),
      0
    );

    const discountAmount = fee_items.reduce(
      (total, item) => total + Number(item.discount_amount || 0),
      0
    );

    const payableAmount =
      standardAmount - discountAmount;

    const feeResult = await client.query(
      `
      INSERT INTO tbl_student_fees (
        student_id,
        academic_year_id,
        standard_amount,
        discount_amount,
        payable_amount,
        paid_amount,
        status,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, 0, 'PENDING', true)
      RETURNING *
      `,
      [
        student_id,
        academic_year_id,
        standardAmount,
        discountAmount,
        payableAmount
      ]
    );

    const studentFeeId =
      feeResult.rows[0].student_fee_id;

    for (const item of fee_items) {
      await client.query(
        `
        INSERT INTO tbl_student_fee_items (
          student_fee_id,
          fee_category_id,
          standard_amount,
          discount_amount,
          payable_amount,
          paid_amount
        )
        VALUES ($1, $2, $3, $4, $5, 0)
        `,
        [
          studentFeeId,
          item.fee_category_id,
          item.standard_amount,
          item.discount_amount || 0,
          Number(item.standard_amount) -
          Number(item.discount_amount || 0)
        ]
      );
    }

    for (const installment of installments) {
      await client.query(
        `
        INSERT INTO tbl_fee_installments (
          student_id,
          student_fee_id,
          academic_year_id,
          installment_number,
          due_date,
          amount,
          paid_amount,
          status,
          is_active
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 0, 'PENDING', true
        )
        `,
        [
          student_id,
          studentFeeId,
          academic_year_id,
          installment.installment_number,
          installment.due_date,
          installment.amount
        ]
      );
    }

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Fee assigned successfully",
      feeResult.rows[0]
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.log("Assign fee error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to assign fee"
    );
  } finally {
    client.release();
  }
};

export const addFeePayment = async (req, res) => {
  const client = await pool.connect();

  try {
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

    const receiptFile = req.file
      ? req.file.location || req.file.path
      : null;

    await client.query("BEGIN");

    const feeResult = await client.query(
      `
      SELECT
        student_fee_id,
        payable_amount,
        paid_amount
      FROM tbl_student_fees
      WHERE student_fee_id = $1
        AND student_id = $2
        AND is_active = true
      FOR UPDATE
      `,
      [student_fee_id, student_id]
    );

    if (feeResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        404,
        "Student fee not found"
      );
    }

    const fee = feeResult.rows[0];

    const balance =
      Number(fee.payable_amount) -
      Number(fee.paid_amount);

    if (Number(amount) > balance) {
      await client.query("ROLLBACK");

      return sendErrorResponse(
        res,
        400,
        "Payment amount cannot be greater than pending balance"
      );
    }

    const receiptNumberResult = await client.query(
      `
      SELECT
        'REC-' ||
        LPAD(
          (
            COALESCE(
              MAX(payment_id),
              0
            ) + 1
          )::TEXT,
          5,
          '0'
        ) AS receipt_number
      FROM tbl_fee_payments
      `
    );

    const receiptNumber =
      receiptNumberResult.rows[0].receipt_number;

    const paymentResult = await client.query(
      `
      INSERT INTO tbl_fee_payments (
        student_id,
        student_fee_id,
        installment_id,
        receipt_number,
        amount,
        payment_date,
        payment_mode,
        transaction_reference,
        receipt_file,
        remarks,
        collected_by,
        is_active
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, true
      )
      RETURNING *
      `,
      [
        student_id,
        student_fee_id,
        installment_id || null,
        receiptNumber,
        amount,
        payment_date,
        payment_mode,
        transaction_reference || null,
        receiptFile,
        remarks || null,
        req.user.user_id
      ]
    );

    const newPaidAmount =
      Number(fee.paid_amount) +
      Number(amount);

    const newStatus =
      newPaidAmount >= Number(fee.payable_amount)
        ? "PAID"
        : "PARTIAL";

    await client.query(
      `
      UPDATE tbl_student_fees
      SET
        paid_amount = $1,
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE student_fee_id = $3
      `,
      [
        newPaidAmount,
        newStatus,
        student_fee_id
      ]
    );

    if (installment_id) {
      const installmentResult = await client.query(
        `
        SELECT
          amount,
          paid_amount
        FROM tbl_fee_installments
        WHERE installment_id = $1
          AND is_active = true
        FOR UPDATE
        `,
        [installment_id]
      );

      if (installmentResult.rows.length > 0) {
        const installment =
          installmentResult.rows[0];

        const installmentPaid =
          Number(installment.paid_amount) +
          Number(amount);

        const installmentStatus =
          installmentPaid >= Number(installment.amount)
            ? "PAID"
            : "PARTIAL";

        await client.query(
          `
          UPDATE tbl_fee_installments
          SET
            paid_amount = $1,
            status = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE installment_id = $3
          `,
          [
            installmentPaid,
            installmentStatus,
            installment_id
          ]
        );
      }
    }

    await client.query("COMMIT");

    return sendSuccessResponse(
      res,
      201,
      "Payment added successfully",
      paymentResult.rows[0]
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.log("Add fee payment error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to add fee payment"
    );
  } finally {
    client.release();
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { academic_year_id } = req.query;

    if (!isValidId(student_id)) {
      return sendErrorResponse(
        res,
        400,
        "Valid student ID is required"
      );
    }

    const result = await pool.query(
      `
      SELECT
        fp.payment_id,
        fp.receipt_number,
        fp.payment_date,
        fp.amount,
        fp.payment_mode,
        fp.transaction_reference,
        fp.receipt_file,
        fp.remarks,
        s.full_name AS student_name,
        s.admission_number
      FROM tbl_fee_payments fp
      INNER JOIN tbl_students s
        ON s.student_id = fp.student_id
      WHERE fp.student_id = $1
        AND fp.academic_year_id = $2
        AND fp.is_active = true
      ORDER BY fp.payment_date DESC, fp.payment_id DESC
      `,
      [student_id, academic_year_id]
    );

    return sendSuccessResponse(
      res,
      200,
      "Payment history fetched successfully",
      result.rows
    );
  } catch (error) {
    console.log("Get payment history error:", error);

    return sendErrorResponse(
      res,
      500,
      "Failed to fetch payment history"
    );
  }
};