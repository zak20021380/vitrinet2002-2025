const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const auth = require('../middlewares/authMiddleware');
const WhereIsQuiz = require('../models/WhereIsQuiz');

const router = express.Router();

const OPTION_IDS = ['a', 'b', 'c', 'd'];
const QUIZ_SLUG = 'default';
const QUIZ_UPLOAD_SUBDIR = path.join('uploads', 'where-is-quiz');
const QUIZ_UPLOAD_DIR = path.join(__dirname, '..', QUIZ_UPLOAD_SUBDIR);
const QUIZ_IMAGE_PLACEHOLDER = '/assets/images/shop-placeholder.svg';
const DEFAULT_REWARD_TOMAN = 5000;

if (!fs.existsSync(QUIZ_UPLOAD_DIR)) {
  fs.mkdirSync(QUIZ_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, QUIZ_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 7 * 1024 * 1024 }, // 7MB
  fileFilter: (req, file, cb) => {
    if (!file || !file.mimetype) {
      return cb(new Error('فرمت فایل معتبر نیست.'));
    }
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('فقط فایل تصویری مجاز است.'));
    }
    cb(null, true);
  }
});

function uploadQuizImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'حجم تصویر باید کمتر از ۷ مگابایت باشد.' });
    }
    return res.status(400).json({ message: error.message || 'آپلود تصویر انجام نشد.' });
  });
}

function parseBoolean(input, fallback = false) {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return input === 1;
  if (typeof input === 'string') {
    const value = input.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(value)) return true;
    if (['false', '0', 'no', 'off'].includes(value)) return false;
  }
  return fallback;
}

function normaliseOptionsFromBody(body = {}) {
  return OPTION_IDS.map((id) => ({
    id,
    text: String(body[`option${id.toUpperCase()}`] || '').trim()
  }));
}

function normaliseCorrectOptionDetails(input = {}) {
  return {
    description: String(input?.description || '').trim().slice(0, 1200),
    link: String(input?.link || '').trim().slice(0, 500),
    address: String(input?.address || '').trim().slice(0, 320)
  };
}

function normaliseCorrectOptionDetailsFromBody(body = {}) {
  return normaliseCorrectOptionDetails({
    description: body?.correctOptionDescription,
    link: body?.correctOptionLink,
    address: body?.correctOptionAddress
  });
}

function normaliseStoredRewardToman(input, fallback = DEFAULT_REWARD_TOMAN) {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  if (rounded < 0) return fallback;
  return rounded;
}

function parseRewardTomanFromRequest(input) {
  if (input === undefined || input === null || input === '') return DEFAULT_REWARD_TOMAN;
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 0) return null;
  return rounded;
}

function toClientQuiz(
  doc,
  { includeAnswer = false, includeReward = false, includeCorrectOptionDetails = false } = {}
) {
  if (!doc) {
    const payload = {
      title: 'اینجا کجاست؟',
      subtitle: 'حدس بزن و جایزه ببر',
      imageUrl: QUIZ_IMAGE_PLACEHOLDER,
      options: OPTION_IDS.map((id, index) => ({ id, text: `گزینه ${index + 1}` })),
      active: false,
      updatedAt: null
    };
    if (includeReward) {
      payload.rewardToman = DEFAULT_REWARD_TOMAN;
    }
    if (includeCorrectOptionDetails) {
      payload.correctOptionDetails = normaliseCorrectOptionDetails();
    }
    return payload;
  }

  const options = Array.isArray(doc.options)
    ? doc.options
        .map((item) => ({
          id: OPTION_IDS.includes(String(item?.id || '').toLowerCase())
            ? String(item.id).toLowerCase()
            : null,
          text: String(item?.text || '').trim()
        }))
        .filter((item) => item.id && item.text)
    : [];

  const orderedOptions = OPTION_IDS.map((id) => {
    const found = options.find((item) => item.id === id);
    return found || { id, text: '' };
  });

  const payload = {
    id: String(doc._id || ''),
    title: String(doc.title || 'اینجا کجاست؟').trim() || 'اینجا کجاست؟',
    subtitle: String(doc.subtitle || 'حدس بزن و جایزه ببر').trim() || 'حدس بزن و جایزه ببر',
    imageUrl: String(doc.imageUrl || '').trim() || QUIZ_IMAGE_PLACEHOLDER,
    options: orderedOptions,
    active: Boolean(doc.active),
    updatedAt: doc.updatedAt || null
  };

  if (includeReward) {
    payload.rewardToman = normaliseStoredRewardToman(doc.rewardToman, DEFAULT_REWARD_TOMAN);
  }

  if (includeAnswer) {
    payload.correctOptionId = OPTION_IDS.includes(String(doc.correctOptionId || '').toLowerCase())
      ? String(doc.correctOptionId).toLowerCase()
      : 'a';
  }

  if (includeCorrectOptionDetails) {
    payload.correctOptionDetails = normaliseCorrectOptionDetails(doc.correctOptionDetails || {});
  }

  return payload;
}

async function getOrCreateQuiz() {
  let quiz = await WhereIsQuiz.findOne({ slug: QUIZ_SLUG });
  if (!quiz) {
    quiz = await WhereIsQuiz.create({ slug: QUIZ_SLUG, updatedAt: new Date() });
  }
  return quiz;
}

function resolveStoredImagePath(imageUrl = '') {
  const value = String(imageUrl || '').trim();
  if (!value.startsWith('/uploads/where-is-quiz/')) return null;
  const filename = path.basename(value);
  if (!filename) return null;
  return path.join(QUIZ_UPLOAD_DIR, filename);
}

async function cleanupStoredImage(imageUrl) {
  const filePath = resolveStoredImagePath(imageUrl);
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('Failed to remove old where-is quiz image:', error.message || error);
    }
  }
}

async function cleanupTempUpload(file) {
  if (!file || !file.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('Failed to clean temp uploaded file:', error.message || error);
    }
  }
}

router.get('/where-is-quiz/public', async (req, res, next) => {
  try {
    const quiz = await getOrCreateQuiz();
    if (!quiz.active) {
      return res.json({
        success: true,
        active: false,
        quiz: null
      });
    }

    return res.json({
      success: true,
      active: true,
      quiz: toClientQuiz(quiz)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/where-is-quiz/submit', auth('user'), async (req, res, next) => {
  try {
    const selectedOptionId = String(req.body?.optionId || '').trim().toLowerCase();
    if (!OPTION_IDS.includes(selectedOptionId)) {
      return res.status(400).json({ message: 'گزینه انتخاب شده معتبر نیست.' });
    }

    const quiz = await getOrCreateQuiz();
    if (!quiz.active) {
      return res.status(409).json({ message: 'در حال حاضر مسابقه فعالی وجود ندارد.' });
    }

    const hasOption = Array.isArray(quiz.options) && quiz.options.some((item) => item && item.id === selectedOptionId);
    if (!hasOption) {
      return res.status(400).json({ message: 'گزینه انتخاب شده برای سوال فعلی معتبر نیست.' });
    }

    const storedCorrectOptionId = String(quiz.correctOptionId || '').trim().toLowerCase();
    const correctOptionId = OPTION_IDS.includes(storedCorrectOptionId) ? storedCorrectOptionId : 'a';
    const isCorrect = selectedOptionId === correctOptionId;
    const rewardToman = normaliseStoredRewardToman(quiz.rewardToman, DEFAULT_REWARD_TOMAN);
    const correctOption = Array.isArray(quiz.options)
      ? quiz.options.find((item) => String(item?.id || '').trim().toLowerCase() === correctOptionId)
      : null;
    const correctOptionText = String(correctOption?.text || '').trim();
    const correctOptionDetails = normaliseCorrectOptionDetails(quiz.correctOptionDetails || {});

    const responsePayload = {
      success: true,
      isCorrect,
      correctOption: {
        id: correctOptionId,
        text: correctOptionText
      },
      correctOptionDetails,
      message: isCorrect
        ? 'پاسخ شما صحیح بود. تبریک!'
        : 'پاسخ شما ثبت شد.'
    };
    if (isCorrect) {
      responsePayload.rewardToman = rewardToman;
    }
    return res.json(responsePayload);
  } catch (error) {
    return next(error);
  }
});

router.get('/where-is-quiz/admin', auth('admin'), async (req, res, next) => {
  try {
    const quiz = await getOrCreateQuiz();
    return res.json({
      success: true,
      quiz: toClientQuiz(quiz, {
        includeAnswer: true,
        includeReward: true,
        includeCorrectOptionDetails: true
      })
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/where-is-quiz/admin/status', auth('admin'), async (req, res, next) => {
  try {
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'active')) {
      return res.status(400).json({ message: 'وضعیت انتشار ارسال نشده است.' });
    }

    const quiz = await getOrCreateQuiz();
    quiz.active = parseBoolean(req.body?.active, Boolean(quiz.active));
    quiz.updatedAt = new Date();
    await quiz.save();

    return res.json({
      success: true,
      message: quiz.active
        ? 'وضعیت انتشار با موفقیت فعال شد.'
        : 'وضعیت انتشار با موفقیت غیرفعال شد.',
      quiz: toClientQuiz(quiz, {
        includeAnswer: true,
        includeReward: true,
        includeCorrectOptionDetails: true
      })
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/where-is-quiz/admin', auth('admin'), uploadQuizImage, async (req, res, next) => {
  try {
    const options = normaliseOptionsFromBody(req.body);
    if (options.some((item) => !item.text)) {
      await cleanupTempUpload(req.file);
      return res.status(400).json({ message: 'متن هر ۴ گزینه باید تکمیل شود.' });
    }

    const correctOptionId = String(req.body?.correctOptionId || '').trim().toLowerCase();
    if (!OPTION_IDS.includes(correctOptionId)) {
      await cleanupTempUpload(req.file);
      return res.status(400).json({ message: 'گزینه صحیح نامعتبر است.' });
    }

    const rewardToman = parseRewardTomanFromRequest(req.body?.rewardToman);
    if (rewardToman === null) {
      await cleanupTempUpload(req.file);
      return res.status(400).json({ message: 'مبلغ جایزه باید عددی صفر یا بیشتر باشد.' });
    }
    const correctOptionDetails = normaliseCorrectOptionDetailsFromBody(req.body);

    const quiz = await getOrCreateQuiz();
    const previousImageUrl = quiz.imageUrl || '';
    const nextImageUrl = req.file
      ? `/uploads/where-is-quiz/${req.file.filename}`
      : previousImageUrl;

    quiz.title = 'اینجا کجاست؟';
    quiz.subtitle = String(req.body?.subtitle || '').trim() || 'حدس بزن و جایزه ببر';
    quiz.options = options;
    quiz.correctOptionId = correctOptionId;
    quiz.correctOptionDetails = correctOptionDetails;
    quiz.rewardToman = rewardToman;
    quiz.active = parseBoolean(req.body?.active, true);
    quiz.imageUrl = nextImageUrl;
    quiz.updatedAt = new Date();

    await quiz.save();

    if (req.file && previousImageUrl && previousImageUrl !== nextImageUrl) {
      await cleanupStoredImage(previousImageUrl);
    }

    return res.json({
      success: true,
      message: 'سوال «اینجا کجاست؟» با موفقیت ذخیره شد.',
      quiz: toClientQuiz(quiz, {
        includeAnswer: true,
        includeReward: true,
        includeCorrectOptionDetails: true
      })
    });
  } catch (error) {
    await cleanupTempUpload(req.file);
    return next(error);
  }
});

module.exports = router;
