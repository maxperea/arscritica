import type { MusicSource } from "../source";
import { aftonbladet } from "./aftonbladet";
import { gaffa } from "./gaffa";
import { hymn } from "./hymn";
import { kulturbloggen } from "./kulturbloggen";
import { sonic } from "./sonic";
import { svd } from "./svd";

export const musicSources: MusicSource[] = [aftonbladet, gaffa, hymn, kulturbloggen, sonic, svd];
