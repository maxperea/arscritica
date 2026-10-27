import type { Source } from "../source";
import { aftonbladet } from "./aftonbladet";
import { filmtopp } from "./filmtopp";
import { moviezine } from "./moviezine";
import { sr } from "./sr";
import { svt } from "./svt";

export const sources: Source[] = [aftonbladet, filmtopp, moviezine, sr, svt];
