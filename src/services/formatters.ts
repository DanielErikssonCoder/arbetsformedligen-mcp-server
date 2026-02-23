import { JobAd } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";

export function formatJobAdSummary(ad: JobAd): string {
  const lines: string[] = [
    `**${ad.headline}**`,
    `ID: ${ad.id}`,
  ];

  if (ad.employer?.name) lines.push(`Arbetsgivare: ${ad.employer.name}`);
  if (ad.workplace_address?.municipality || ad.workplace_address?.city) {
    lines.push(`Plats: ${ad.workplace_address.city || ad.workplace_address.municipality}`);
  }
  if (ad.occupation?.label) lines.push(`Yrke: ${ad.occupation.label}`);
  if (ad.employment_type?.label) lines.push(`Anställningstyp: ${ad.employment_type.label}`);
  if (ad.application_deadline) lines.push(`Sista ansökningsdag: ${ad.application_deadline.split("T")[0]}`);
  if (ad.webpage_url) lines.push(`Länk: ${ad.webpage_url}`);

  return lines.join("\n");
}

export function formatJobAdFull(ad: JobAd): string {
  const lines: string[] = [
    `# ${ad.headline}`,
    `**ID:** ${ad.id}`,
  ];

  if (ad.employer?.name) lines.push(`**Arbetsgivare:** ${ad.employer.name}`);
  if (ad.workplace_address) {
    const addr = ad.workplace_address;
    const location = [addr.street_address, addr.city || addr.municipality, addr.region, addr.country]
      .filter(Boolean)
      .join(", ");
    if (location) lines.push(`**Adress:** ${location}`);
  }

  if (ad.occupation?.label) lines.push(`**Yrke:** ${ad.occupation.label}`);
  if (ad.occupation_group?.label) lines.push(`**Yrkesgrupp:** ${ad.occupation_group.label}`);
  if (ad.employment_type?.label) lines.push(`**Anställningsform:** ${ad.employment_type.label}`);
  if (ad.duration?.label) lines.push(`**Varaktighet:** ${ad.duration.label}`);
  if (ad.working_hours_type?.label) lines.push(`**Arbetstid:** ${ad.working_hours_type.label}`);
  if (ad.scope_of_work?.min !== undefined) {
    lines.push(`**Tjänstgöringsgrad:** ${ad.scope_of_work.min}–${ad.scope_of_work.max ?? ad.scope_of_work.min}%`);
  }
  if (ad.number_of_vacancies) lines.push(`**Antal platser:** ${ad.number_of_vacancies}`);
  if (ad.salary_type?.label) lines.push(`**Lönetyp:** ${ad.salary_type.label}`);
  if (ad.publication_date) lines.push(`**Publicerad:** ${ad.publication_date.split("T")[0]}`);
  if (ad.application_deadline) lines.push(`**Sista ansökningsdag:** ${ad.application_deadline.split("T")[0]}`);

  if (ad.must_have?.skills?.length) {
    lines.push(`**Krav – kompetenser:** ${ad.must_have.skills.map((s) => s.label).join(", ")}`);
  }
  if (ad.must_have?.languages?.length) {
    lines.push(`**Krav – språk:** ${ad.must_have.languages.map((l) => l.label).join(", ")}`);
  }
  if (ad.nice_to_have?.skills?.length) {
    lines.push(`**Meriterande – kompetenser:** ${ad.nice_to_have.skills.map((s) => s.label).join(", ")}`);
  }

  if (ad.description?.text) {
    lines.push("\n## Beskrivning");
    lines.push(ad.description.text);
  }

  if (ad.webpage_url) lines.push(`\n**Ansök här:** ${ad.webpage_url}`);

  const result = lines.join("\n");
  if (result.length > CHARACTER_LIMIT) {
    return result.slice(0, CHARACTER_LIMIT) + "\n...[trunkerat pga längd]";
  }
  return result;
}

export function truncateIfNeeded(text: string): string {
  if (text.length > CHARACTER_LIMIT) {
    return text.slice(0, CHARACTER_LIMIT) + "\n...[trunkerat pga längd]";
  }
  return text;
}
