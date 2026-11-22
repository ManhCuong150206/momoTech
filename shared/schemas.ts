// JSON Schema (draft-07) cho API v1. Fastify dùng trực tiếp để kiểm tra đầu vào và tuần tự hóa đầu ra.

const str = { type: 'string' } as const;
const strOrNull = { type: ['string', 'null'] } as const;
const mode = { type: 'string', enum: ['simulated', 'live'] } as const;
// R1: nội dung chỉ có khoảng trắng cũng là rỗng.
const invitationText = { type: 'string', minLength: 1, maxLength: 5000, pattern: '\\S' } as const;

const requirement = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'quote'],
  properties: {
    kind: {
      type: 'string',
      enum: [
        'fee_request',
        'attendance_confirmation',
        'shared_office_meeting',
        'address_pending',
        'document_request',
        'credential_request',
        'other_request',
      ],
    },
    quote: { type: 'string', minLength: 1, maxLength: 300 },
  },
} as const;

const extractedField = {
  type: 'object',
  additionalProperties: false,
  required: ['value', 'quote', 'origin'],
  properties: {
    value: strOrNull,
    quote: strOrNull,
    origin: {
      type: 'string',
      enum: ['invitation_text', 'user_input', 'simulated_source', 'ai', 'not_found'],
    },
  },
} as const;

const sourceRef = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'url', 'simulated'],
  properties: { label: strOrNull, url: strOrNull, simulated: { type: 'boolean' } },
} as const;

export const extractRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'invitationText'],
  properties: {
    mode,
    invitationText,
    jobUrl: { type: ['string', 'null'], maxLength: 2000 },
    meetingAddress: { type: ['string', 'null'], maxLength: 500 },
  },
} as const;

export const extractResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'simulated', 'fields', 'requirements', 'notices'],
  properties: {
    mode,
    simulated: { type: 'boolean' },
    fields: {
      type: 'object',
      additionalProperties: false,
      required: ['company', 'role', 'meetingAddress', 'jobUrl'],
      properties: {
        company: extractedField,
        role: extractedField,
        meetingAddress: extractedField,
        jobUrl: extractedField,
      },
    },
    requirements: { type: 'array', items: requirement },
    notices: { type: 'array', items: str },
  },
} as const;

export const verifyRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'invitationText', 'confirmed'],
  properties: {
    mode,
    invitationText,
    jobUrl: { type: ['string', 'null'], maxLength: 2000 },
    save: { type: 'boolean' },
    jobPosting: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        jobCode: { type: ['string', 'null'], maxLength: 100 },
        postedOn: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        closesOn: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        closed: { type: 'boolean' },
      },
    },
    confirmed: {
      type: 'object',
      additionalProperties: false,
      required: ['company', 'role', 'meetingAddress', 'requirements'],
      properties: {
        company: { type: ['string', 'null'], maxLength: 200 },
        role: { type: ['string', 'null'], maxLength: 200 },
        meetingAddress: { type: ['string', 'null'], maxLength: 500 },
        requirements: { type: 'array', maxItems: 10, items: requirement },
      },
    },
  },
} as const;

export const verifyResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'simulated', 'checkedOn', 'job', 'location', 'contact', 'invitation', 'guidance', 'notices', 'historyId'],
  properties: {
    mode,
    simulated: { type: 'boolean' },
    checkedOn: str,
    job: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'basis', 'source', 'checkedOn', 'details'],
      properties: {
        status: { type: 'string', enum: ['open', 'expired', 'unavailable', 'not_checked'] },
        basis: str,
        source: sourceRef,
        checkedOn: strOrNull,
        details: {
          type: 'object',
          additionalProperties: false,
          required: ['company', 'role', 'jobCode', 'postedOn', 'closesOn', 'reason'],
          properties: {
            company: strOrNull,
            role: strOrNull,
            jobCode: strOrNull,
            postedOn: strOrNull,
            closesOn: strOrNull,
            reason: strOrNull,
          },
        },
      },
    },
    location: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'basis', 'source', 'checkedOn', 'place', 'mapUrl'],
      properties: {
        status: {
          type: 'string',
          enum: ['matched', 'company_unconfirmed', 'unavailable', 'not_checked'],
        },
        basis: str,
        source: sourceRef,
        checkedOn: strOrNull,
        place: {
          type: 'object',
          additionalProperties: false,
          required: ['displayName', 'address'],
          properties: { displayName: strOrNull, address: strOrNull },
        },
        mapUrl: strOrNull,
      },
    },
    contact: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'basis'],
      properties: { status: { type: 'string', enum: ['unverified', 'verified'] }, basis: str },
    },
    invitation: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'basis', 'requirements'],
      properties: {
        status: {
          type: 'string',
          enum: ['caution', 'needs_verification', 'no_signal_observed', 'insufficient_information'],
        },
        basis: str,
        requirements: { type: 'array', items: requirement },
      },
    },
    guidance: {
      type: 'object',
      additionalProperties: false,
      required: ['nextStep', 'suggestedQuestion'],
      properties: { nextStep: str, suggestedQuestion: str },
    },
    notices: { type: 'array', items: str },
    historyId: strOrNull,
  },
} as const;

export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service', 'version', 'time', 'modes', 'history', 'capabilities'],
  properties: {
    status: { type: 'string', enum: ['ok'] },
    service: { type: 'string', enum: ['viec-that-api'] },
    version: str,
    time: str,
    modes: { type: 'array', items: mode },
    history: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'ttlDays'],
      properties: { enabled: { type: 'boolean' }, ttlDays: { type: 'integer' } },
    },
    capabilities: {
      type: 'object',
      additionalProperties: false,
      required: ['ai', 'places'],
      properties: { ai: { type: 'boolean' }, places: { type: 'boolean' } },
    },
  },
} as const;

export const demoCasesResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cases'],
  properties: {
    cases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'kind', 'input'],
        properties: {
          id: str,
          title: str,
          kind: { type: 'string', enum: ['simulated'] },
          input: {
            type: 'object',
            additionalProperties: false,
            required: ['invitationText', 'jobUrl', 'meetingAddress'],
            properties: { invitationText: str, jobUrl: strOrNull, meetingAddress: strOrNull },
          },
        },
      },
    },
  },
} as const;

export const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          enum: ['VALIDATION_ERROR', 'QUOTE_NOT_IN_SOURCE', 'SOURCE_MODE_UNSUPPORTED', 'NOT_FOUND', 'HISTORY_DISABLED', 'RATE_LIMITED', 'INTERNAL_ERROR'],
        },
        message: str,
        details: {},
      },
    },
  },
} as const;

const uuid = { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' } as const;

export const historyIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: uuid },
} as const;

export const historyListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'createdAt', 'expiresAt', 'mode', 'simulated', 'title', 'jobStatus', 'locationStatus', 'invitationStatus'],
        properties: {
          id: uuid,
          createdAt: str,
          expiresAt: str,
          mode,
          simulated: { type: 'boolean' },
          title: str,
          jobStatus: { type: 'string', enum: ['open', 'expired', 'unavailable', 'not_checked'] },
          locationStatus: { type: 'string', enum: ['matched', 'company_unconfirmed', 'unavailable', 'not_checked'] },
          invitationStatus: {
            type: 'string',
            enum: ['caution', 'needs_verification', 'no_signal_observed', 'insufficient_information'],
          },
        },
      },
    },
  },
} as const;

export const historyDetailResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'createdAt', 'expiresAt', 'title', 'input', 'confirmed', 'result'],
  properties: {
    id: uuid,
    createdAt: str,
    expiresAt: str,
    title: str,
    input: {
      type: 'object',
      additionalProperties: false,
      required: ['invitationText', 'jobUrl'],
      properties: { invitationText: str, jobUrl: strOrNull },
    },
    confirmed: verifyRequestSchema.properties.confirmed,
    result: verifyResponseSchema,
  },
} as const;

export const deleteHistoryRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ids'],
  properties: { ids: { type: 'array', minItems: 1, maxItems: 100, items: uuid } },
} as const;

export const deleteHistoryResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['deleted'],
  properties: { deleted: { type: 'integer' } },
} as const;
