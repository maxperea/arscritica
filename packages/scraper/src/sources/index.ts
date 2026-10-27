import type { Source } from "../source";
import { aftonbladet } from "./aftonbladet";
import { filmbladet } from "./filmbladet";
import { filmtopp } from "./filmtopp";
import { moviezine } from "./moviezine";
import { svd } from "./svd";

export const sources: Source[] = [aftonbladet, filmbladet, filmtopp, moviezine, svd];
