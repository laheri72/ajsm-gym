const { z } = require('zod');

const sqlControlChars = /['";\\]|--|\/\*|\*\//;

const cleanString = (max) => z.string()
  .trim()
  .min(1)
  .max(max)
  .refine((value) => !sqlControlChars.test(value), { message: 'Invalid characters' });

const schemas = {
  studentLogin: z.object({
    tr: z.coerce.number().int().min(1000).max(999999),
    password: z.string().min(1).max(128)
  }),
  staffLogin: z.object({
    username: cleanString(50).regex(/^[A-Za-z0-9._@-]+$/),
    password: z.string().min(1).max(128)
  }),
  setPassword: z.object({
    newPassword: z.string()
      .min(6, { message: 'Password must be at least 6 characters long.' })
      .max(128, { message: 'Password cannot exceed 128 characters.' })
  })
};

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid input format.';
      return res.status(400).json({ success: false, message });
    }

    req.body = parsed.data;
    next();
  };
}

module.exports = { schemas, validateBody };
