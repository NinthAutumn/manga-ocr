import { CategoryType, ChapterState, ContentType } from "./enum.ts";

export interface CategoryEntity {
  name: string;
  description: string;
  type: CategoryType;
}
export interface AliasEntity {
  name: string;
}
export interface EpubBook {
  title: string;
  author: string;
  cover: string;
  content: EpubContent[];
}

export interface EpubContent {
  title: string;
  data: string;
}
export interface ChapterEntity {
  title?: string;
  index?: number;
  content?: ContentEntity[];
  footer?: string;
  header?: string;
  raw_url: string;
  volume_id?: number;
  word_count?: number;
  state?: ChapterState;
  book_id: number;
}

export namespace ModernMT {
  export interface DTO {
    source: string;
    target: string;
    q: string;
  }
  export interface ModernMTResponse {
    contextVector: Object;
    translation: string;
  }
}
export interface updateInterface {
  update: boolean;
  chapter_count?: number;
  volume_index?: number;
  raw_link?: string;
  volume_id?: number;
}
export interface ContentEntity {
  type: ContentType;
  index: number;
  content: string;
  original: string;
}
export interface VolumeEntity {
  id?: number;
  title: string;
  description?: string;
  index: number;
  chapters: ChapterEntity[];
}
