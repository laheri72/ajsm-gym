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
    newPassword: z.string().min(10).max(128)
      .regex(/[A-Z]/, { message: 'Requires uppercase' })
      .regex(/[a-z]/, { message: 'Requires lowercase' })
      .regex(/[0-9]/, { message: 'Requires a number' })
  })
};

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input format.' });
    }

    req.body = parsed.data;
    next();
  };
}

module.exports = { schemas, validateBody };
