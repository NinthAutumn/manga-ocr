import { ModernMT, ContentEntity } from "../models";
import Axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import { readFile, writeFile, sleep, chunk } from "../utility";
import { VolumeEntity, ChapterEntity } from "../models";
const { promisify, existsSync, unlinkSync } = require("fs");
require("dotenv").config();
export default async function translateBook(
  volum: boolean,
  random: string,
  source: string = "ja",
  bookId: number
) {
  try {
    if (existsSync(`./books/${bookId}-true.json`)) {
      return;
    } else if (existsSync(`./books/${bookId}-false.json`)) {
      return;
    }
    if (volum) {
      const data = await readFile(`./temp-books/${bookId}-true-raw.json`, {
        encoding: "utf8",
      });
      let volumes = JSON.parse(data) as VolumeEntity[];
      for (let volume of volumes) {
        let result = await modernMtTranslation({
          q: volume.title,
          source,
          target: "en",
        });
        while (result.length < 1 && volume.title.length > 0) {
          await sleep(1000);
          result = await modernMtTranslation({
            q: volume.title,
            source,
            target: "en",
          });
        }
        // .translateText({
        //   contents: [volume.title], mimeType: 'text/plain', parent: `projects/${projectId}/locations/${location}`,
        //   model: `projects/${projectId}/locations/global/models/general/nmt`
        // });
        volume.title = result;
        for (let chapter of volume.chapters) {
          // console.log(chapter);
          let word_count = 0;
          let content_index = 0;
          result = await modernMtTranslation({
            q: chapter.title,
            source,
            target: "en",
          });
          while (result.length < 1) {
            await sleep(1000);
            result = await modernMtTranslation({
              q: chapter.title,
              source,
              target: "en",
            });
          }
          chapter.title = result.replace(
            /[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g,
            ""
          );
          // return console.log(content);
          // let cont = await modernMtTranslation({ q: content, source: 'ja', target: 'en' });
          // return console.log(cont);
          chapter.content = chapter.content.filter(
            (content) => content.original.length > 0
          );
          let chunked_content = chunk(
            chapter.content.map((cont) => cont.original),
            25
          );
          for (let left of chunked_content) {
            let translations = await modernMtTranslation(
              { q: "", source, target: "en" },
              left,
              chapter.content
            );
            while (translations.length < 1) {
              await sleep(1000);
              translations = await modernMtTranslation(
                { q: "", source, target: "en" },
                left,
                chapter.content
              );
            }
            console.log(translations.length);
            for (let translated of translations) {
              chapter.content[content_index].content = translated.replace(
                /[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g,
                ""
              );
              word_count += translated
                .replace(
                  /[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g,
                  ""
                )
                .split(/\s/gi).length;
              content_index++;
            }
          }

          // for (let content of chapter.content) {
          //   for (let translation of translations) {
          //     content.content = translation.replace(/[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g, "");
          //     word_count += translation.replace(/[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g, "").split(/\s/gi).length
          //   }
          // }

          chapter.word_count = word_count;
          console.log(chapter.title);
        }
      }
      await unlinkSync(`./temp-books/${bookId}-true-raw.json`);
      await writeFile(`./books/${bookId}-true.json`, JSON.stringify(volumes));
    } else {
      const data = await readFile(`./temp-books/${bookId}-false-raw.json`, {
        encoding: "utf8",
      });
      let chapters = JSON.parse(data) as ChapterEntity[];

      for (let chapter of chapters) {
        let content_index = 0;
        let word_count = 0;
        let result = await modernMtTranslation({
          q: chapter.title,
          source,
          target: "en",
        });
        while (result.length < 1) {
          await sleep(1000);
          result = await modernMtTranslation({
            q: chapter.title,
            source,
            target: "en",
          });
        }
        chapter.title = result;
        chapter.content = chapter.content.filter(
          (content) => content.original.length > 0
        );
        let chunked_content = chunk(
          chapter.content.map((cont) => cont.original),
          25
        );
        for (let left of chunked_content) {
          let translations = await modernMtTranslation(
            { q: "", source, target: "en" },
            left,
            chapter.content
          );
          while (translations.length < 1) {
            await sleep(1000);
            translations = await modernMtTranslation(
              { q: "", source, target: "en" },
              left,
              chapter.content
            );
          }
          for (let translated of translations) {
            chapter.content[content_index].content = translated.replace(
              /[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g,
              ""
            );
            word_count += translated
              .replace(
                /[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g,
                ""
              )
              .split(/\s/gi).length;
            content_index++;
          }
          // await sleep(100);
        }
        // await sleep(150);
        chapter.word_count = word_count;
        console.log(chapter.title);
      }
      await unlinkSync(`./temp-books/${bookId}-false-raw.json`);
      await writeFile(`./books/${bookId}-false.json`, JSON.stringify(chapters));
    }
  } catch (error) {
    // await writeFile('./modern.json', JSON.stringify(chapters))
    console.log(error);
  }
}

export async function modernMtTranslation(
  modernMT: ModernMT.DTO,
  contents?: string[],
  all_content?: ContentEntity[]
): Promise<any> {
  const { source, target, q } = modernMT;
  let axiosLists: Array<any> = [];
  // Axios.defaults.headers.common["MMT-ApiKey"] = process.env.MMT_KEY;
  if (contents) {
    let index = 0;
    for (let content of contents) {
      axiosLists.push(
        Axios.post(
          `https://webapi.modernmt.com/translate`,
          {
            source,
            target,
            q: content,
            // context: contents.join("\n"),
            // hints: [18680],
            // hints: [21190],
          },
          {
            headers: {
              "X-HTTP-Method-Override": "GET",
              // "MMT-ApiKey": process.env.MMT_KEY,
            },
          }
        )
      );
    }
    let translations: Array<any> = [];
    let responses;
    try {
      responses = await Promise.all([...axiosLists]);
      for (let res of responses as AxiosResponse[]) {
        // console.log(res)
        const data = res.data;
        translations.push(data.data.translation);
      }
    } catch (error) {
      console.log("object");
      // console.log(error);
      if (error.response) {
        console.log(error.response.data);
      }
    }

    return translations;
  } else {
    try {
      let { data } = await Axios.post(
        `https://webapi.modernmt.com/translate`,
        {
          source,
          target,
          q: q || " ",
          // hints: [18680],
          // hints: [21190],
        },
        {
          headers: {
            "X-HTTP-Method-Override": "GET",
            // "MMT-ApiKey": process.env.MMT_KEY,
          },
        }
      );
      data = data.data as ModernMT.ModernMTResponse;
      return data.translation;
    } catch (error) {
      console.log("error title");
      console.log(error);
      if (error.response) {
        console.log(error.response.data);
      }
      return "";
    }
  }
}
