const HomeCardSection = require('../models/homeCardSection');

const normaliseSlug = HomeCardSection.normaliseSlug || ((slug) => slug);

function toBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const lowered = `${value}`.toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(lowered)
    ? true
    : ['0', 'false', 'no', 'off'].includes(lowered)
    ? false
    : defaultValue;
}

function toNumber(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

function sanitiseText(value) {
  if (value === undefined || value === null) return '';
  return `${value}`.trim();
}

function mapCardPayload(cardBody = {}) {
  const payload = {
    title: sanitiseText(cardBody.title),
    tag: sanitiseText(cardBody.tag),
    description: sanitiseText(cardBody.description),
    location: sanitiseText(cardBody.location),
    price: sanitiseText(cardBody.price),
    imageUrl: sanitiseText(cardBody.imageUrl),
    link: sanitiseText(cardBody.link),
    buttonText: sanitiseText(cardBody.buttonText),
    order: toNumber(cardBody.order),
    isActive: toBoolean(cardBody.isActive, true),
  };

  if (!payload.title) {
    throw new Error('TITLE_REQUIRED');
  }

  return payload;
}

function serialiseSection(sectionDoc) {
  if (!sectionDoc) return null;
  const plain = sectionDoc.toObject({ virtuals: false });
  const cards = Array.isArray(plain.cards)
    ? [...plain.cards]
        .map((card) => ({
          ...card,
          _id: card._id?.toString?.() || card._id,
          order: toNumber(card.order),
          isActive: toBoolean(card.isActive, true),
        }))
        .sort((a, b) => {
          if (a.order !== b.order) {
            return a.order - b.order;
          }
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return aTime - bTime;
        })
    : [];

  return {
    _id: plain._id,
    title: plain.title,
    subtitle: plain.subtitle || '',
    description: plain.description || '',
    slug: plain.slug,
    viewAllText: plain.viewAllText || '',
    viewAllLink: plain.viewAllLink || '',
    order: toNumber(plain.order),
    isActive: toBoolean(plain.isActive, true),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    cards,
  };
}

exports.getPublicSections = async (req, res) => {
  try {
    const sections = await HomeCardSection.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const normalised = sections.map((section) => ({
      ...section,
      order: toNumber(section.order),
      cards: Array.isArray(section.cards)
        ? section.cards
            .filter((card) => toBoolean(card.isActive, true))
            .map((card) => ({
              ...card,
              _id: card._id?.toString?.() || card._id,
              order: toNumber(card.order),
              isActive: true,
            }))
            .sort((a, b) => a.order - b.order)
        : [],
    }));

    res.json(normalised);
  } catch (err) {
    console.error('Error fetching public home sections:', err);
    res.status(500).json({ message: 'خطا در دریافت اطلاعات سکشن‌ها' });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const slug = normaliseSlug(req.params.slug);
    const section = await HomeCardSection.findOne({ slug });

    if (!section || !toBoolean(section.isActive, true)) {
      return res.status(404).json({ message: 'سکشن موردنظر یافت نشد.' });
    }

    const serialised = serialiseSection(section);
    serialised.cards = serialised.cards.filter((card) => toBoolean(card.isActive, true));

    res.json(serialised);
  } catch (err) {
    console.error('Error fetching section by slug:', err);
    res.status(500).json({ message: 'خطا در دریافت سکشن' });
  }
};

exports.getAllSections = async (req, res) => {
  try {
    const sections = await HomeCardSection.find()
      .sort({ order: 1, createdAt: -1 });
    res.json(sections.map(serialiseSection));
  } catch (err) {
    console.error('Error fetching all sections:', err);
    res.status(500).json({ message: 'خطا در دریافت لیست سکشن‌ها' });
  }
};

exports.getSectionById = async (req, res) => {
  try {
    const section = await HomeCardSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ message: 'سکشن یافت نشد.' });
    }
    res.json(serialiseSection(section));
  } catch (err) {
    console.error('Error fetching section by id:', err);
    res.status(500).json({ message: 'خطا در دریافت سکشن' });
  }
};

exports.createSection = async (req, res) => {
  try {
    const payload = {
      title: sanitiseText(req.body.title),
      subtitle: sanitiseText(req.body.subtitle),
      description: sanitiseText(req.body.description),
      slug: normaliseSlug(req.body.slug),
      viewAllText: sanitiseText(req.body.viewAllText),
      viewAllLink: sanitiseText(req.body.viewAllLink),
      order: toNumber(req.body.order),
      isActive: toBoolean(req.body.isActive, true),
    };

    if (!payload.title) {
      return res.status(400).json({ message: 'عنوان سکشن الزامی است.' });
    }

    if (!payload.slug) {
      return res.status(400).json({ message: 'اسلاگ سکشن الزامی است.' });
    }

    if (Array.isArray(req.body.cards)) {
      payload.cards = req.body.cards.map(mapCardPayload);
    }

    const section = await HomeCardSection.create(payload);
    res.status(201).json(serialiseSection(section));
  } catch (err) {
    console.error('Error creating section:', err);
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'اسلاگ تکراری است. مقدار دیگری انتخاب کنید.' });
    }
    if (err?.message === 'TITLE_REQUIRED') {
      return res.status(400).json({ message: 'عنوان کارت الزامی است.' });
    }
    res.status(500).json({ message: 'خطا در ایجاد سکشن جدید.' });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const section = await HomeCardSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ message: 'سکشن یافت نشد.' });
    }

    const fields = ['title', 'subtitle', 'description', 'viewAllText', 'viewAllLink'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        section[field] = sanitiseText(req.body[field]);
      }
    });

    if (req.body.slug !== undefined) {
      const newSlug = normaliseSlug(req.body.slug);
      if (!newSlug) {
        return res.status(400).json({ message: 'اسلاگ معتبر نیست.' });
      }
      section.slug = newSlug;
    }

    if (req.body.order !== undefined) {
      section.order = toNumber(req.body.order);
    }

    if (req.body.isActive !== undefined) {
      section.isActive = toBoolean(req.body.isActive, true);
    }

    if (Array.isArray(req.body.cards)) {
      section.cards = req.body.cards.map(mapCardPayload);
    }

    await section.save();
    res.json(serialiseSection(section));
  } catch (err) {
    console.error('Error updating section:', err);
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'اسلاگ تکراری است.' });
    }
    if (err?.message === 'TITLE_REQUIRED') {
      return res.status(400).json({ message: 'عنوان کارت الزامی است.' });
    }
    res.status(500).json({ message: 'خطا در ویرایش سکشن.' });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const section = await HomeCardSection.findByIdAndDelete(req.params.id);
    if (!section) {
      return res.status(404).json({ message: 'سکشن یافت نشد.' });
    }
    res.json({ message: 'سکشن با موفقیت حذف شد.' });
  } catch (err) {
    console.error('Error deleting section:', err);
    res.status(500).json({ message: 'خطا در حذف سکشن.' });
  }
};

exports.addCard = async (req, res) => {
  try {
    const section = await HomeCardSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ message: 'سکشن یافت نشد.' });
    }

    const cardPayload = mapCardPayload(req.body);
    section.cards.push(cardPayload);

    await section.save();
    res.status(201).json(serialiseSection(section));
  } catch (err) {
    console.error('Error adding card:', err);
    if (err?.message === 'TITLE_REQUIRED') {
      return res.status(400).json({ message: 'عنوان کارت الزامی است.' });
    }
    res.status(500).json({ message: 'خطا در افزودن کارت.' });
  }
};

exports.updateCard = async (req, res) => {
  try {
    const section = await HomeCardSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ message: 'سکشن یافت نشد.' });
    }

    const card = section.cards.id(req.params.cardId);
    if (!card) {
      return res.status(404).json({ message: 'کارت یافت نشد.' });
    }

    const updatable = ['title', 'tag', 'description', 'location', 'price', 'imageUrl', 'link', 'buttonText'];
    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        card[field] = sanitiseText(req.body[field]);
      }
    });

    if (req.body.order !== undefined) {
      card.order = toNumber(req.body.order);
    }

    if (req.body.isActive !== undefined) {
      card.isActive = toBoolean(req.body.isActive, true);
    }

    if (!card.title) {
      return res.status(400).json({ message: 'عنوان کارت نمی‌تواند خالی باشد.' });
    }

    await section.save();
    res.json(serialiseSection(section));
  } catch (err) {
    console.error('Error updating card:', err);
    res.status(500).json({ message: 'خطا در ویرایش کارت.' });
  }
};

exports.removeCard = async (req, res) => {
  try {
    const section = await HomeCardSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ message: 'سکشن یافت نشد.' });
    }

    const card = section.cards.id(req.params.cardId);
    if (!card) {
      return res.status(404).json({ message: 'کارت یافت نشد.' });
    }

    card.remove();
    await section.save();
    res.json(serialiseSection(section));
  } catch (err) {
    console.error('Error removing card:', err);
    res.status(500).json({ message: 'خطا در حذف کارت.' });
  }
};
