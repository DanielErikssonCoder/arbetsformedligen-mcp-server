export interface JobAd {
  id: string;
  headline: string;
  description?: {
    text?: string;
    text_formatted?: string;
  };
  application_deadline?: string;
  number_of_vacancies?: number;
  employment_type?: { label?: string };
  salary_type?: { label?: string };
  employer?: {
    name?: string;
    organization_number?: string;
    workplace?: string;
  };
  workplace_address?: {
    municipality?: string;
    region?: string;
    country?: string;
    street_address?: string;
    postcode?: string;
    city?: string;
    coordinates?: number[];
  };
  occupation?: { label?: string };
  occupation_group?: { label?: string };
  occupation_field?: { label?: string };
  must_have?: {
    skills?: Array<{ label?: string }>;
    languages?: Array<{ label?: string }>;
    education_level?: Array<{ label?: string }>;
  };
  nice_to_have?: {
    skills?: Array<{ label?: string }>;
    languages?: Array<{ label?: string }>;
  };
  duration?: { label?: string };
  working_hours_type?: { label?: string };
  scope_of_work?: { min?: number; max?: number };
  publication_date?: string;
  last_publication_date?: string;
  webpage_url?: string;
  logo_url?: string;
}

export interface SearchResponse {
  total: { value: number };
  hits: JobAd[];
  freetext_concepts?: unknown;
}

export interface TaxonomyApiResponse {
  "taxonomy/id": string;
  "taxonomy/type": string;
  "taxonomy/preferred-label": string;
  "taxonomy/deprecated"?: boolean;
  "taxonomy/definition"?: string;
}

export interface TaxonomyConcept {
  conceptId: string;
  preferredLabel: string;
  type?: string;
  deprecated?: boolean;
  definition?: string;
}

export interface TaxonomyResponse {
  data: {
    concepts: TaxonomyConcept[];
  };
}

export interface AutocompleteResponse {
  typeahead: Array<{
    value: string;
    occurrences: number;
    type: string;
  }>;
}
