
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

const QUESTION_HELPERS = {
  q1: {
    title: "What should I enter here?",
    detail: "Enter the name of the project, property, or listing you are evaluating.",
    why: "This helps identify your evaluation and will appear in your report.",
    example: "Example: 'Sunshine Residences' or 'Lot in Barangay San Isidro'",
  },
  q2: {
    title: "Who is selling or developing the property?",
    detail: "Enter the company, developer, broker, or individual offering the property.",
    why: "Knowing who is behind the project helps assess credibility and track record.",
    example: "Example: 'ABC Development Corp.' or 'Juan Dela Cruz (owner)'",
  },
  q3: {
    title: "Why is location important?",
    detail: "Select the city or municipality where the property is located.",
    why: "Local government rules and permits depend on the exact location.",
    example: "Example: 'Quezon City'",
  },
  q4: {
    title: "What should I select here?",
    detail: "Select the region where the property is located.",
    why: "Some regulations and environmental factors vary by region.",
    example: "Example: 'NCR (National Capital Region)' or 'Region IV-A (CALABARZON)'",
  },
  q5: {
    title: "What type of property is this?",
    detail: "Choose the closest category that describes the property.",
    why: "Different property types follow different rules and risks.",
    example: "Subdivision, Condominium, House and Lot, Vacant Land",
  },
  q6: {
    title: "How is the property being sold?",
    detail:
      "Identify whether this is sold directly by a developer, privately, or through a broker.",
    why: "The type of sale can affect documentation, regulation, and risk level.",
    example: "Developer Project (pre-selling), Private Sale, Broker Listing",
  },
  q7: {
    title: "What is a License to Sell (LTS)?",
    detail:
      "A License to Sell is issued by DHSUD and allows a developer to legally sell units in a project.",
    why: "If no LTS is shown, the developer may not yet be legally allowed to sell the property.",
    example: "Ask the developer for a copy or reference number of the LTS.",
  },
  q8: {
    title: "What does this question check?",
    detail:
      "This asks whether the developer has completed other real estate projects before.",
    why: "Developers with a track record are generally easier to verify and assess.",
    example: "Search online or ask for past project names.",
  },
  q9: {
    title: "What is a Development Permit?",
    detail:
      "This is approval from the local government allowing the project to be constructed.",
    why: "Without this permit, the project may not be authorized to proceed.",
    example: "Ask for proof of local government approval.",
  },
  q10: {
    title: "What is an Environmental Compliance Certificate (ECC)?",
    detail: "An ECC confirms that a project meets environmental regulations, when required.",
    why: "This helps identify environmental risks or restrictions affecting the project.",
    example: "Larger developments usually require ECC.",
  },
  q11: {
    title: "What do these title types mean?",
    detail:
      "TCT or CCT means the property has an individual title. A Mother Title means the land is still part of a larger property.",
    why: "Clear and individual titles are generally easier to verify and transfer.",
    example:
      "Mother Title may mean subdivision into individual titles is still pending.",
  },
  q12: {
    title: "What counts as a title issue?",
    detail:
      "This includes disputes, mortgages, legal claims, or unclear ownership.",
    why: "Title issues can delay or prevent ownership transfer.",
    example: "Ask if the title has liens, disputes, or pending cases.",
  },
  q13: {
    title: "What is in-house financing?",
    detail:
      "This means the developer or seller provides payment plans directly to buyers.",
    why: "This can be convenient but may also shift more control to the seller.",
    example: "Compare with bank financing if available.",
  },
  q14: {
    title: "Are you being asked to pay early?",
    detail:
      "This checks if payments are required before key permits or documents are secured.",
    why: "Early payments increase financial risk if the project is incomplete or delayed.",
    example: "Reservation fees or deposits before permits are shown.",
  },
  q15: {
    title: "What are local government restrictions?",
    detail:
      "These include zoning rules, moratoriums, or limits on development.",
    why: "Restrictions may affect whether the project can proceed as planned.",
    example: "Check with the local city or municipal office.",
  },
  q16: {
    title: "What environmental risks should I look for?",
    detail:
      "This includes flooding, landslides, protected areas, or hazard zones.",
    why: "Environmental risks affect safety, value, and long-term usability.",
    example: "Check flood maps or ask about past flooding.",
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

function isDeveloperProject(responses = {}) {
  return normalizeSaleMode(responses.q6) === "developer_project";
}

function withContextOverrides(question, contextProfile) {
  const baseQuestion = {
    ...question,
    helper: question.helper || QUESTION_HELPERS[question.id] || undefined,
    helperText: question.helperText || undefined,
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
  let baseQuestions = QUESTIONS.map((question) =>
    withContextOverrides(question, contextProfile)
  );

  // Hide developer-only questions unless the user selected Developer Project.
  if (!isDeveloperProject(responses)) {
    baseQuestions = baseQuestions.filter(
      (q) => !["q7", "q8", "q9", "q10"].includes(q.id)
    );
  }

  return baseQuestions;
}