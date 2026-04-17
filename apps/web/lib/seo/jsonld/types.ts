export type {
  Person,
  Organization,
  WebSite,
  WebPage,
  ContactPage,
  BlogPosting,
  Article,
  BreadcrumbList,
  ListItem,
  FAQPage,
  Question,
  Answer,
  HowTo,
  HowToStep,
  VideoObject,
  ImageObject,
  Graph,
  Thing,
  WithContext,
} from 'schema-dts'

export type JsonLdNode = { '@type': string; '@id'?: string;[k: string]: unknown }
export type JsonLdGraph = { '@context': 'https://schema.org'; '@graph': JsonLdNode[] }
