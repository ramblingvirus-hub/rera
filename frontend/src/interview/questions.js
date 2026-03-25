
export const QUESTIONS = [
  {
    id: "q1",
    label: "Property reference or name",
    type: "text",
    section: "Project Information"
  },
  {
    id: "q2",
    label: "Who is selling or developing the property?",
    type: "text",
    section: "Project Information"
  },
  {
    id: "q3",
    label: "City or Municipality",
    type: "text",
    section: "Project Information"
  },
  {
    id: "q4",
    label: "Region",
    type: "select",
    options: [
      "NCR (National Capital Region)",
      "CAR (Cordillera Administrative Region)",
      "Region I (Ilocos Region)",
      "Region II (Cagayan Valley)",
      "Region III (Central Luzon)",
      "Region IV-A (CALABARZON)",
      "Region IV-B (MIMAROPA)",
      "Region V (Bicol Region)",
      "Region VI (Western Visayas)",
      "Region VII (Central Visayas)",
      "Region VIII (Eastern Visayas)",
      "Region IX (Zamboanga Peninsula)",
      "Region X (Northern Mindanao)",
      "Region XI (Davao Region)",
      "Region XII (SOCCSKSARGEN)",
      "Region XIII (Caraga)",
      "BARMM (Bangsamoro Autonomous Region in Muslim Mindanao)",
      "Not Sure"
    ],
    section: "Project Information"
  },
  {
    id: "q5",
    label: "Property type",
    type: "select",
    options: [
      "Subdivision",
      "Condominium",
      "House and Lot",
      "Vacant Land",
      "Agricultural Land",
      "Mixed-Use",
      "Not Sure"
    ],
    section: "Project Information"
  },
  {
    id: "q6",
    label: "How is this property offered for sale?",
    type: "select",
    options: [
      "Developer Project",
      "Private Sale",
      "Broker Listing",
      "Not Sure"
    ],
    section: "Project Information"
  },

  {
    id: "q7",
    label: "Has the developer shown a valid License to Sell (LTS)?",
    type: "radio",
    options: ["Yes", "No", "No documents shown", "Not Sure"],
    section: "Developer Legitimacy"
  },

  {
    id: "q8",
    label: "Is the developer known to have completed other real estate projects before this one?",
    type: "radio",
    options: ["Yes", "No", "I cannot find information about the developer", "Not Sure"],
    section: "Developer Legitimacy"
  },

  {
    id: "q9",
    label: "Has the developer shown any local government approval or permit for developing this property?",
    type: "radio",
    options: ["Yes", "No", "No documents shown", "Not Sure"],
    section: "Project Compliance"
  },

  {
    id: "q10",
    label: "Has the developer shown an Environmental Compliance Certificate (ECC) or environmental approval for this development?",
    type: "radio",
    options: [
        "Yes",
        "No",
        "No documents shown",
        "Developer says ECC is not required",
        "Not Sure"
    ],
    section: "Project Compliance"
  },

  {
    id: "q11",
    label: "What type of land title or ownership document has been shown for this property?",
    type: "radio",
    options: [
        "TCT",
        "CCT",
        "Mother Title",
        "Tax Declaration",
        "Agrarian Reform Title",
        "Rights Only",
        "No title shown",
        "Not Sure"
    ],
    section: "Title and Land"
  },

  {
    id: "q12",
    label: "Are you aware of any claims, mortgages, disputes, or other issues affecting the property title?",
    type: "radio",
    options: [
        "No known issues",
        "Issues disclosed",
        "Seller claims title is clean but no proof shown",
        "Not Sure"
    ],
    section: "Title and Land"
  },

  {
    id: "q13",
    label: "Does the seller or developer offer in-house financing or installment payment plans directly through them?",
    type: "radio",
    options: ["Yes", "No", "Not Sure"],
    section: "Financial Exposure"
  },

  {
    id: "q14",
    label: "Are buyers asked to make reservation fees, deposits, or installment payments before key permits or ownership documents are shown?",
    type: "radio",
    options: ["Yes", "No", "Not Sure"],
    section: "Financial Exposure"
  },

  {
    id: "q15",
    label: "Are you aware of any local government restrictions that may affect development in this area?",
    type: "radio",
    options: ["Yes", "No", "Not Sure"],
    section: "LGU and Environmental Context"
  },

  {
    id: "q16",
    label: "Are you aware of environmental risks affecting this property (flooding, landslides, protected zones)?",
    type: "radio",
    options: ["Yes", "No", "Not Sure"],
    section: "LGU and Environmental Context"
  }
];

export const PRIVATE_SALE_SUPPLEMENTAL_QUESTION_IDS = ["ps1", "ps2", "ps3", "ps4", "ps5"];

const DEFAULT_HELPERS = {
  q6: {
    what: "This sets the transaction context used to interpret succeeding regulatory answers.",
    why: "Private sale, developer project, and broker listing flows carry different legal checkpoints.",
    impact: "Context shifts how risk signals and information gaps are interpreted.",
    tip: "If unsure, select Not Sure so the report flags this context as an information gap.",
  },
  q7: {
    what: "A License to Sell is issued by DHSUD and allows a developer to legally market and sell units.",
    why: "Selling without LTS can indicate unauthorized or premature selling.",
    impact: "YES strengthens legitimacy; NO is a high-risk trigger; Not Sure creates a verification gap.",
    tip: "If unsure, select Not Sure so this appears in Information Gaps for follow-up.",
  },
  q9: {
    what: "Development permit is local government approval to begin development.",
    why: "Without permit support, construction may be non-compliant or halted.",
    impact: "YES improves compliance confidence; NO raises regulatory risk; Not Sure weakens certainty.",
    tip: "If unsure, select Not Sure so permit status is highlighted for due diligence.",
  },
  q10: {
    what: "ECC or equivalent environmental approval confirms environmental compliance requirements.",
    why: "Missing environmental clearance can trigger stoppage, penalties, or legal exposure.",
    impact: "YES is positive; NO raises environmental/legal risk; 'not required' is treated as unverified claim.",
    tip: "If unsure, select Not Sure so the report marks environmental clearance as unresolved.",
  },
  q11: {
    what: "Title type describes the legal ownership document attached to the property.",
    why: "Some title types are stronger and easier to verify than others.",
    impact: "TCT/CCT signals stronger ownership; weaker title forms lower confidence and score.",
    tip: "If title documents are unclear, use Not Sure so title validation is surfaced in the report.",
  },
  q12: {
    what: "This checks for disputes, encumbrances, or unresolved claims on title.",
    why: "Title issues can block transfer and materially increase legal risk for buyers.",
    impact: "Clean status is positive; disclosed issues or unsupported clean-title claims are risk signals.",
    tip: "If unsure, select Not Sure to ensure title status appears in Information Gaps.",
  },
  q14: {
    what: "This asks whether buyers are asked to pay before key permits or ownership proof are validated.",
    why: "Early payment can increase financial exposure if documentation is incomplete.",
    impact: "YES creates a financial risk signal; NO supports safer transaction structure.",
    tip: "If payment terms are unclear, select Not Sure so payment conditions are flagged for review.",
  },
  q16: {
    what: "This checks whether the property is exposed to flood, landslide, protected-zone, or similar environmental risks.",
    why: "Environmental exposure can affect safety, insurability, and long-term property value.",
    impact: "YES raises risk; NO is a positive signal; Not Sure becomes an information gap.",
    tip: "If unsure, select Not Sure to prioritize environmental verification in the report.",
  },
};

const DEFAULT_SIGNALS = {
  q7: {
    trigger: ["No", "No documents shown"],
    message: "Risk signal: the project may not currently be authorized for legal sale.",
  },
  q12: {
    trigger: ["Issues disclosed", "Seller claims title is clean but no proof shown"],
    message: "Risk signal: title integrity concerns require formal verification before payment.",
  },
  q14: {
    trigger: "Yes",
    message: "Risk signal: early payment before document validation can indicate elevated transaction risk.",
  },
};

const PRIVATE_SALE_SUPPLEMENTAL_QUESTIONS = [
  {
    id: "ps1",
    label: "Is the seller the registered owner on the title?",
    type: "radio",
    options: ["Yes", "No", "Not Sure"],
    section: "Private Sale Context",
  },
  {
    id: "ps2",
    label: "Has a copy of the title been shown?",
    type: "radio",
    options: ["Yes", "No", "Not Sure"],
    section: "Private Sale Context",
  },
  {
    id: "ps3",
    label: "What type of title is presented?",
    type: "radio",
    options: ["Individual Title", "Mother Title", "Tax Declaration", "Rights Only"],
    section: "Private Sale Context",
  },
  {
    id: "ps4",
    label: "Has the seller explained the ownership transfer process?",
    type: "radio",
    options: ["Yes", "No", "Not Sure"],
    section: "Private Sale Context",
  },
  {
    id: "ps5",
    label: "Is a licensed broker involved?",
    type: "radio",
    options: ["Yes", "No", "Not Sure"],
    section: "Private Sale Context",
  },
];

const PRIVATE_SALE_OVERRIDES = {
  q7: {
    label: "For this private sale, was any License to Sell (LTS) mentioned?",
    helperText:
      "In private sales, LTS is usually not required. Use this to flag possible transaction-type mismatch.",
  },
  q9: {
    label: "For this property, is there development permit evidence if active development is involved?",
    helperText:
      "This is lower priority for completed private resale properties and more relevant for development-oriented land.",
  },
  q10: {
    label: "For this property, is environmental approval (ECC) evidence available if development/conversion is involved?",
    helperText:
      "ECC context is lower priority for completed private resale properties and more relevant for development/conversion scenarios.",
  },
  q11: {
    helperText:
      "In private sales, title type is a critical ownership legitimacy signal.",
  },
  q12: {
    helperText:
      "In private sales, title verification is high importance for due diligence.",
  },
};

export function normalizeSaleMode(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

export function getContextProfile(responses = {}) {
  if (normalizeSaleMode(responses.q6) === "private_sale") {
    return "private_sale";
  }
  return "default";
}

function withContextOverrides(question, contextProfile) {
  const baseQuestion = {
    ...question,
    helper: question.helper || undefined,
    helperText: question.helperText || DEFAULT_HELPERS[question.id] || undefined,
    signal: question.signal || DEFAULT_SIGNALS[question.id] || undefined,
  };

  if (contextProfile !== "private_sale") {
    return baseQuestion;
  }

  const override = PRIVATE_SALE_OVERRIDES[baseQuestion.id];
  if (!override) {
    return baseQuestion;
  }

  return {
    ...baseQuestion,
    ...override,
  };
}

export function getQuestionsForContext(responses = {}) {
  const contextProfile = getContextProfile(responses);
  const baseQuestions = QUESTIONS.map((question) =>
    withContextOverrides(question, contextProfile)
  );

  if (contextProfile !== "private_sale") {
    return baseQuestions;
  }

  const insertBeforeIndex = baseQuestions.findIndex((q) => q.id === "q13");
  if (insertBeforeIndex === -1) {
    return [...baseQuestions, ...PRIVATE_SALE_SUPPLEMENTAL_QUESTIONS];
  }

  return [
    ...baseQuestions.slice(0, insertBeforeIndex),
    ...PRIVATE_SALE_SUPPLEMENTAL_QUESTIONS,
    ...baseQuestions.slice(insertBeforeIndex),
  ];
}