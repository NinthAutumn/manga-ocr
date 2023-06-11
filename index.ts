// const vision = require("@google-cloud/vision");
import vision from "@google-cloud/vision";
import { readFile, writeFile, sleep, chunk } from "./utility";
import { createCanvas, loadImage, registerFont, Image, Canvas } from "canvas";
import { modernMtTranslation } from "./translate/modernmt";
import {
  ContentEntity,
  VolumeEntity,
  ChapterEntity,
  updateInterface,
} from "./models";
import { ContentType, FeatureType } from "./models/enum";
interface coordinateEntity {
  x: number;
  y: number;
}
// const { spawn } = require('child_process');
import { spawnSync, spawn } from "child_process";
interface boundEntity {
  vertices: coordinateEntity[];
  text: string;
}
const { Worker } = require("worker_threads");
import async from "async";

// import fs from "fs";
import fs, { readdir, existsSync } from "fs-promise";
import axios from "axios";
import { load } from "cheerio";
import { google } from "@google-cloud/translate/build/protos/protos";
import { googleTranslateHandler } from "../translate/google_free";
const s3 = require("s3-node-client");
const options = {
  s3Options: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: "us-east-1",
  },
  // more options available. See API docs below.
};
const client = s3.createClient(options);
// (async () => {
//   let book_id = 1560;
//   const params = {
//     localDir: `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${book_id}/`,
//     deleteRemoved: false, // default false, whether to remove s3 objects
//     // that have no corresponding local file.
//     s3Params: {
//       Bucket: "img.nobles.jp",
//       Prefix: `manga/${book_id}/`,
//       // other options supported by putObject, except Body and ContentLength.
//       // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
//     },
//   };
//   const volumes = JSON.parse(
//     await readFile(`temp-books/${book_id}-true-raw.json`, "utf8")
//   ) as VolumeEntity[];
//   for (let volume of volumes) {
//     let index = 1;
//     for (let chapter of volume.chapters) {
//       for (let content of chapter.content) {
//         content.original = `https://img.nobles.jp/manga/${book_id}/${index}/${content.index}-original.jpg`;
//         content.content = `https://img.nobles.jp/manga/${book_id}/${index}/${content.index}.jpg`;
//       }
//       index++;
//     }
//   }
//   await writeFile(`books/${book_id}-true.json`, JSON.stringify(volumes));
//   const localDir = `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${book_id}/`;
//   const promisedSpawn = () => {
//     return new Promise((resolve, reject) => {
//       let proc = spawn(`aws`, [
//         "s3",
//         "sync",
//         localDir,
//         `s3://img.nobles.jp/manga/${book_id}`,
//       ]);
//       process.stdin.pipe(proc.stdin);

//       proc.stdout.on("data", (data) => {
//         console.log(`${data}`);
//       });
//       return proc.on("exit", (code, signal) => {
//         console.log(code, signal);
//         if (signal) return reject(signal);
//         return resolve(signal);
//       });
//     });
//   };
//   let err = true;
//   while (err) {
//     try {
//       await promisedSpawn();
//       err = false;
//     } catch (error) {
//       console.log(error, "error");
//       err = true;
//     }
//   }

//   return;
// })();
async function uploadOcrImages(book_id: number, update: boolean = false) {
  let res = await axios.post("http://0.0.0.0:3000/api/mtl/auth/login", {
    credential: process.env.USER_USERNAME,
    password: process.env.USER_PASSWORD,
  });
  const files = await readdir(
    `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${book_id}`
  );
  const temp_files = await readdir(
    `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${book_id}`
  );
  for (let i = 0; i < temp_files.length; i++) {
    const chapter_files = await readdir(
      `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${book_id}/${temp_files[i]}`
    );
    // return console.log(chapter_files);
    for (let j = 0; j < chapter_files.length; j++) {
      const index = chapter_files[j].split(".")[0];
      await fs.copy(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${book_id}/${temp_files[i]}/${chapter_files[j]}`,
        `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${book_id}/${temp_files[i]}/${index}-original.jpg`
      );
    }
  }
  const params = {
    localDir: `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${book_id}/`,
    deleteRemoved: false, // default false, whether to remove s3 objects
    // that have no corresponding local file.
    s3Params: {
      Bucket: "img.nobles.jp",
      Prefix: `manga/${book_id}/`,
      // other options supported by putObject, except Body and ContentLength.
      // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
    },
  };
  const localDir = `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${book_id}/`;
  const promisedSpawn = () => {
    return new Promise((resolve, reject) => {
      let proc = spawn(`aws`, [
        "s3",
        "sync",
        localDir,
        `s3://img.nobles.jp/manga/${book_id}`,
      ]);
      process.stdin.pipe(proc.stdin);

      proc.stdout.on("data", (data) => {
        console.log(`${data}`);
      });
      proc.on("exit", (code, signal) => {
        console.log(code, signal);
        if (signal) return reject();
        return resolve();
      });
    });
  };
  let error = true;
  while (error) {
    try {
      await promisedSpawn();
      error = false;
    } catch (error) {
      error = true;
      await sleep(300);
    }
  }
}
// export enum FeatureType {
//   PARAGRAPH = "paragraph",
//   BLOCK = "block",
//   WORD = "word",
// }
interface ImageMeta {
  canvas_images: Image[];
  buffer_image: Buffer;
  buffer_image_location: string;
  buffer_image_translated_location: string;
  total_height: number;
}

async function unStichImages(images: ImageMeta[], writePath: string) {
  const files = await fs.readdir(writePath);
  const image_length = images.reduce((prev, cur) => {
    return (prev += cur.canvas_images.length);
  }, 0);
  if (files.length === image_length) {
    console.log("files already made");
  } else {
    await fs.mkdirs(writePath);
    let content_index = 0;
    for (let image of images) {
      const file = await readFile(image.buffer_image_translated_location);
      const canvas = createCanvas(
        image["canvas_images"][0].width,
        image["total_height"]
      );
      const ctx = canvas.getContext("2d");
      const img = await loadImage(file);
      await ctx.drawImage(img, 0, 0);
      let offset_height = 0;
      for (let canvas_image of image["canvas_images"]) {
        const imgData = ctx.getImageData(
          0,
          offset_height,
          canvas_image.width,
          canvas_image.height
        );
        const new_canvas = createCanvas(imgData.width, imgData.height);
        const context = new_canvas.getContext("2d");
        context.putImageData(imgData, 0, 0);

        // console.log(imgData);
        // const buf = Buffer.from(data);
        await writeFile(
          `${writePath}/${content_index++}.jpg`,
          new_canvas.toBuffer()
        );
        offset_height += canvas_image.height;
      }
    }
  }
}

async function stichImages(file_location: string) {
  console.log("stiching image");
  // const file_location = `temp-comic/${book_id}/${chapter_index}`;
  const files = await fs.readdir(
    `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${file_location}`
  );
  let total_heights = [0] as number[];
  await fs.mkdirs(
    `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-ocr/untranslated/${file_location}`
  );
  await fs.mkdirs(
    `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-ocr/translated/${file_location}`
  );
  let images = [
    {
      canvas_images: [],
      total_height: 0,
      buffer_image: null,
      buffer_image_location: `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-ocr/untranslated/${file_location}/${0}.jpg`,
      buffer_image_translated_location: `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-ocr/translated/${file_location}/${0}.jpg`,
    },
  ] as ImageMeta[];
  let index = 0;
  files.sort((a: any, b: any) => {
    let cur = parseInt(a.split(".")[0]);
    let next = parseInt(b.split(".")[0]);
    if (cur > next) {
      return 1;
    } else if (cur < next) {
      return -1;
    } else {
      return 0;
    }
  });
  let current_height = 0;
  for (let file of files) {
    let load;
    try {
      load = await loadImage(
        await readFile(
          `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${file_location}/${file}`
        )
      );
    } catch (error) {
      console.log(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${file_location}/${file}`
      );
      throw new Error("error");
    }
    if (current_height > 18000) {
      images.push({
        canvas_images: [load],
        total_height: 0,
        buffer_image: null,
        buffer_image_location: `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-ocr/untranslated/${file_location}/${images.length}.jpg`,
        buffer_image_translated_location: `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-ocr/translated/${file_location}/${images.length}.jpg`,
      });
      // total_heights[loaded_images.length - 1] = 0;
      current_height = 0;
    } else {
      images[images.length - 1]["canvas_images"].push(load);
      current_height += load.height;
    }
    images[images.length - 1]["total_height"] += load.height;
  }
  // console.log(total_heights);
  // let images = [] as Buffer[];
  // console.log("calculated ");
  for (let i = 0; i < images.length; i++) {
    if (existsSync(images[i]["buffer_image_location"])) {
      console.log(images[i]["buffer_image_location"], "already exists");
      images[i]["buffer_image"] = await fs.readFile(
        images[i]["buffer_image_location"]
      );
    } else {
      const canvas = createCanvas(
        images[i]["canvas_images"][0].width,
        images[i]["total_height"]
      );
      const ctx = canvas.getContext("2d");
      let current_height = 0;
      for (let image of images[i]["canvas_images"]) {
        try {
          await ctx.drawImage(image, 0, current_height);
        } catch (error) {
          console.log(images[i]["buffer_image_location"]);
          throw new Error("asdfasdfasd");
        }
        current_height += image.height;
      }
      images[i]["buffer_image"] = canvas.toBuffer();

      await writeFile(images[i]["buffer_image_location"], canvas.toBuffer());
    }
  }

  return { image: "", images: images };
  // let image_width = loaded_images[0].width;
  // const canvas = createCanvas(image_width, total_height);
  // const ctx = canvas.getContext("2d");
  // let current_height = 0;
  // for (let image of loaded_images) {
  //   ctx.drawImage(image, 0, current_height);
  //   current_height += image.height;
  // }
  // await writeFile(`ocr/image.png`, canvas.toBuffer());
  // return { image: canvas.toBuffer(), meta: loaded_images };
}
export async function ocrImageChapter(
  feature: FeatureType,
  draw: boolean = true,
  draw_info?: {
    image: string;
    book_id?: number;
    chapter_index?: number;
    contents: ContentEntity[];
  }
): Promise<ContentEntity[]> {
  const client = new vision.ImageAnnotatorClient({
    credentials: JSON.parse(await readFile("src/cred.json", "utf8")),
  });
  const file_location = `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${draw_info.book_id}/${draw_info.chapter_index}/`;
  const destination = `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${draw_info.book_id}/${draw_info.chapter_index}/`;
  let result;
  let file;
  if (draw) {
    // if (!fs.existsSync(`temp-comic/${draw_info.book_id}`)) {
    //   await fs.mkdir(`temp-comic/${draw_info.book_id}`);
    //   await fs.mkdir(`comic/${draw_info.book_id}`);
    // }
    // if (
    //   !fs.existsSync(
    //     `temp-comic/${draw_info.book_id}/${draw_info.chapter_index}`
    //   )
    // ) {
    await fs.mkdirs(
      `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${draw_info.book_id}/${draw_info.chapter_index}`
    );
    await fs.mkdirs(
      `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${draw_info.book_id}/${draw_info.chapter_index}`
    );
    // }
    let files = await fs.readdir(file_location);
    // for (let file of files) {
    //   console.log(file);
    // }
    // return;
    for (let content of draw_info.contents) {
      const writer = fs.createWriteStream(`${file_location}/${content.index}`);
      await downloadImage(content.original, writer);
    }

    let stiched = await stichImages(file_location);
    [result] = await client.documentTextDetection(stiched.image);
    // while (!result.fullTextAnnotation) {
    //   console.log("error");
    //   [result] = await client.documentTextDetection(file);
    // }
  } else {
    [result] = await client.documentTextDetection(draw_info.image);
    while (!result.fullTextAnnotation) {
      console.log("error");
      [result] = await client.documentTextDetection(draw_info.image);
    }
  }

  let bounds = [] as boundEntity[];
  let contents = [] as ContentEntity[];
  let content_index = 1;
  let sentence = ``;
  if (!result.fullTextAnnotation && draw) {
    await writeFile(destination, await drawBoxes(null, file));
    return null;
  }
  for (let page of result.fullTextAnnotation.pages) {
    for (let block of page.blocks) {
      for (let paragraph of block.paragraphs) {
        for (let word of paragraph.words) {
          sentence += word.symbols.reduce((acc: any, cur: any) => {
            return acc + cur.text;
          }, "");
        }
        if (feature === FeatureType.PARAGRAPH) {
          // sentence = await modernMtTranslation({
          //   q: sentence,
          //   source: "ko",
          //   target: "en",
          // });
          contents.push({
            original: sentence,
            content: "",
            type: ContentType.PARAGRAPH,
            index: content_index++,
          });
          if (draw) {
            sentence = await modernMtTranslation({
              q: sentence,
              source: "ko",
              target: "en",
            });
          }
          bounds.push({
            ...paragraph.boundingBox,
            text: sentence,
          } as boundEntity);
          sentence = "";
        }
      }
      if (feature === FeatureType.BLOCK) {
        // sentence = await modernMtTranslation({
        //   q: sentence,
        //   source: "ko",
        //   target: "en",
        // });
        contents.push({
          original: sentence,
          content: "",
          type: ContentType.PARAGRAPH,
          index: content_index++,
        });
        if (draw) {
          sentence = await modernMtTranslation({
            q: sentence,
            source: "ko",
            target: "en",
          });
        }
        bounds.push({
          ...block.boundingBox,
          text: sentence,
        } as boundEntity);
        sentence = "";
      }
      // console.log(sentence);
    }
  }
  if (draw) {
    await writeFile(destination, await drawBoxes(bounds, file));
    return null;
  } else {
    return contents;
  }
}
async function drawBoxes(bounds: boundEntity[], img: Buffer): Promise<Buffer> {
  let image = await loadImage(img); // Load the image first to get its dimensions
  const canvas = createCanvas(image.width, image.height);
  if (!bounds) return canvas.toBuffer();
  const ctx = canvas.getContext("2d");
  const offsetY = 20,
    offsetX = 20;
  ctx.drawImage(image, 0, 0);
  bounds.forEach((bound) => {
    ctx.beginPath();
    ctx.fillStyle = "white";
    const boxHeight = bound.vertices[2].y - bound.vertices[1].y;
    const boxWidth = bound.vertices[1].x - bound.vertices[0].x;
    ctx.strokeStyle = "white";
    ctx.fillRect(
      bound.vertices[0].x - offsetX,
      bound.vertices[0].y - offsetY,
      boxWidth + offsetX,
      boxHeight + offsetY
    );

    ctx.stroke();
    ctx.font = "1pt arial";
    let height = parseInt(ctx.font);
    bound.text = calculateHeight(ctx, bound.text, boxWidth);
    // bound.text.split("\n").length * height
    while (bound.text.split("\n").length * height <= boxHeight * 0.75) {
      ctx.font = `${++height}pt arial`;
      bound.text = calculateHeight(
        ctx,
        bound.text.replace(/\n/gi, " "),
        boxWidth
      );
    }
    if (bound.text.split("\n").length * height >= boxHeight * 0.75) {
      ctx.font = `${--height}pt arial`;
      bound.text = calculateHeight(
        ctx,
        bound.text.replace(/\n/gi, " "),
        boxWidth
      );
    }

    // while (bound.text.split("\n").length * height >= boxHeight * 0.75) {
    //   // console.log(bound.text.split("\n").length, height);
    //   // console.log(, boxHeight);
    // }

    // console.log(bound.text);
    let width = calculateLongestLineWidth(ctx, bound.text);
    let fontsize = height;
    for (let i = 0; i < 100; i++) {
      // if (fontsize < 16) {
      //   fontsize = 16;
      //   ctx.font = `${fontsize}pt arial`;
      //   bound.text = calculateHeight(
      //     ctx,
      //     bound.text.replace(/\n/gi, " "),
      //     bound.vertices[1].x - bound.vertices[0].x
      //   );
      //   break;
      // }
      ctx.font = `${fontsize}pt  'Segoe UI'`;
      width = calculateLongestLineWidth(ctx, bound.text);
      fontsize = (boxWidth / width) * fontsize;
    }

    ctx.fillStyle = "black";

    ctx.fillText(
      bound.text,
      bound.vertices[0].x - offsetX / 2,
      bound.vertices[0].y + fontsize - offsetY / 2
    );
  });
  return canvas.toBuffer();
}

function calculateHeight(ctx: CanvasText, text: string, maxWidth: number) {
  var words = text.split(" ");
  var lines = [];
  var currentLine = words[0];
  for (var i = 1; i < words.length; i++) {
    var word = words[i];
    var width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines.join("\n");
}

function calculateLongestLineWidth(ctx: CanvasText, text: string) {
  let lines = text.split(/\n/gi);
  let largest = -1;
  lines.forEach((line) => {
    largest = Math.max(largest, ctx.measureText(line).width);
  });
  return largest;
}

// (async () => {
// let strins = `百度搜索杂志虫www.zineworm. com更新更!百度搜索杂志虫www.zineworm. com更新更快杂志虫\nhei66. com\n|“一护,八点钟方向出现了虚。”\n说着,露琪亚就一把拉起了正在上课的黑崎一护\n跑出了教室,身后,传来了老师愤怒的咆哮声。\n“我说露琪亚你的那破玩意是不是故障了,要知\n道这几次我们过去可都没有见到虚。”\n黑崎一护被露琪亚拖着很不爽,不满的开口说道\n“别废话,赶紧走。”\n说着,露琪亚就把黑崎一护的灵魂从身体里搜了\n出来。\n几分钟后,两人来到了之前有虚的位置,而这一\n达,这地方的虚并没有像之前那样被消灭了。\n“没想到这次还真有虚,就让本大爷超度了你吧\n说着,黑崎一护就拔出了新魄刀,准备解决眼前\n的虚。\n就在这时,一道蓝色的箭突然射到了虚的面具上\n直接把虚灭杀了。\n“嗯003?\n然只是一击就把虚给杀了?\n黑崎一护脸上满是震惊,对方竟,\n“你就是黑崎一护吧?”\nク\n石田雨龙的身影从一旁出现,眼中有些愤怒。\n“是我没错,你有事找我?”\n“没错,你这个低级的死神,我痛恨死神!”\n石田雨龙想起了昨天暴揍自己的那人,心中忍不\n住愤怒起来。\n躲在一旁的罗看着这一墓,有些不满,喃喃自语\n的开口:“石天同学你会不会嘲讽,应该直接说:你\n个垃圾,这不省事多了么?”\n不过到底石田雨龙的还是说不出这种话,只是不\n断向黑崎一护贬低着死神,吃低着黑崎一护是多么渣\n多么渣,连自己这种“强大”的同班同学都感觉不到\n不过石田雨龙的“嘲讽”还是起作用了,黑崎一\n(bbef)护直接生气了。\n对黑崎一护来说,露琪亚在他心中还是很重要的\n石田雨龙这么贬低死神,不就是等于直接在骂露琪\n亚?这让黑崎一护很是不爽。\n“怎么样?要不要来比试一下,看看到底死神强\n还是灭却师强? 我手里的东西只要捏碎,就能把周围\n的虚都吸引过来,到时候的胜负就用各自杀的虚的数\n目来衡定吧。\nク\n“等等,你这,。4\n黑崎一护话还没说完,石由的成就捏碎了手里的\n东西。\n“混蛋,你知不知道这会害死多少无辜的人?”\n黑崎一护脸上满是愤怒的对着石田兩龙吼道。\n“只要有我在,这單的虚一个都别想跑掉,怎么\n? 你是怕自己的能力无法保护别人么?”\n|“怎么可能。\n“那不就行了,对了。\n会优先攻击灵魂浓度高的人。”\n忘了提醒你,虚可是\n听到这话,黑崎一护脸色一变,就朝着一个方向\n跑去。\n“夏莉!”\n石田雨龙抬手射杀了一个虚,看着离开的黑崎一\n护,淡淡的说道:“始终还是太弱么?黑崎一护,好\n好看看周围吧。要知道,.,不是只有你的家人才拥\n有高灵力。”\n路上,井上织姫正和好闺蜜龙贵走着。\n“织姬,话说你不是喜欢上你的老板了吧?”\n这段时间龙贵已经听说了井上织姬说过太多次她\n的店长是多么多么好,多么多么师。\n井上织姬脸色一红,慌忙的解释:“哪有?你想\n多了。”\n但井上织姬的解释是那样苍白无力,反而让龙贵\n越加肯定自己的猜测。\n就在下一刻,井上织姬的脸色一变,开口:“龙\n贵,快跑!”\n此时井上织姬已经用见闻色霸气感受到了这片地\n区突然急剧增加的虚,这让从来没有和虚作战过的她\n脸色有些发白。\n龙贵脸色也是一变,她的灵魂浓度也很高,已经\n能够模糊的看见虚了,此时她已经看见一个虚出现在\n井上织姬的背后。\n|“小心,织姬!”\n龙贵突然把井上织姬扑倒,而那个巨太的虚的攻\n击却直接攻击到了她的身上,把她的背后划出一大道\nロ子。\n“龙贵!”\n井上织姬看到了这一幕,一下于呆住了,脸上满\n是无助。\n“你忘了自己的能力了吗?”\n突然,一道淡淡的声音传入井上织姬的耳中,惊\n醒了慌乱中的她。\n“店长!”\n井上织姬一下子像是找到了主心骨,哀求的眼神\n看向罗。\n罗看了一眼井上织姬,开口:“我不会出手、你\n难道忘记了你师父和我教给你的力量?”\n听到这话,井上织姬脸色慌张的神色慢慢消失了\n转而出现坚定的神色。\n“是,店长!”\n这时候那个虚也再次向着井上织姬攻击了过来。\n比起之前,井上织姬再也没有情张,而是迅速的\n开口。\n“火无菊!梅严! 莉莉\n三天结盾!我拒绝\n!\n井上织姬的发卡突然飞了出来,有着六片花瓣的\n发卡上有三片花瓣飞了出来,在井上织姬面前结成了\n一个巨大的盾牌!\n早在一个月前井上织姬就已经觉醒了言灵,并\n得到了其中的能力。\n飞卢提醒您:读书三件事 - 收藏、推荐、分享!\n(lendlige2000)\n支持飞卢小说网 (http://b.faloo.\ncom)原创作品,尽享阅读的喜悦!\nhei66. com\n百度搜索杂志虫www.zineworm com更新更百度搜索杂志虫www. zineworm com更新更快杂志虫\n`;
// console.log(
//   strins
//     .replace(/\n/gi, "")
//     .replace(/([!?]|[。”])(?=.+)/gm, "$1|")
//     .split("|")
//     .reduce((acc: any, cur: any) => {
//       console.log(cur[0], cur[cur.length - 1]);
//       if (cur === "”" || (cur[0] !== "“" && cur[cur.length - 1] === "”")) {
//         return acc + cur;
//       } else if (cur.length < 1) {
//         return acc;
//       } else {
//         return `${acc}\n${cur}`;
//       }
//     }, "")
//   // .join("\n")
// );
//
// const client = new vision.ImageAnnotatorClient({
//   credentials: JSON.parse(await readFile("src/cred.json", "utf8")),
// });
// // const file = await readFile(
// // );
// const [result] = await client.documentTextDetection(
//   "https://www.kanmaoxian.com/files/article/attachment/53/53562/10337357/431085.gif"
// );
// console.log(result);
// await writeFile("ocr/1.json", JSON.stringify(result));
// await ocrImage(FeatureType.BLOCK, false, "");
// })();
// export async function ocrImage() {}
async function downloadImage(url: string, writer: any) {
  (
    await axios.get(encodeURI(url), {
      responseType: "stream",
      headers: {
        "user-agent": `Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Mobile Safari/537.36`,
      },
    })
  ).data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

export default async function ocrBookHandler(
  book_id: number,
  language: string = "ko",
  update: updateInterface = { update: false }
) {
  const volumes = JSON.parse(
    await readFile(`temp-books/${book_id}-true-raw.json`, "utf8")
  ) as VolumeEntity[];
  let chapter_index = 1;
  if (update.update) chapter_index += update.chapter_count;
  const client = new vision.ImageAnnotatorClient({
    credentials: JSON.parse(await readFile("src/cred.json", "utf8")),
  });
  for (let volume of volumes) {
    // let chapter_index = 1;
    console.log("start of chapter");

    for (let chapter of volume.chapters) {
      chapter.index = chapter_index++;
    }
    let promise_list = [];
    for (let chapter of volume.chapters) {
      await handleChapterOcr(chapter, language);
    }
  }
  let upload = true;
  while (upload) {
    try {
      await uploadOcrImages(book_id, update.update);
      upload = false;
    } catch (error) {
      await sleep(500);
      console.log(error);
      console.log("error uploadingocr");
    }
  }

  await writeFile(`books/${book_id}-true.json`, JSON.stringify(volumes));
}

async function handleChapterOcr(
  chapter: ChapterEntity,
  language: string = "ko"
) {
  const client = new vision.ImageAnnotatorClient({
    credentials: JSON.parse(await readFile("src/cred.json", "utf8")),
  });
  let feature = FeatureType.BLOCK;
  let book_id = chapter.book_id;
  let draw = true;
  await fs.mkdirs(
    `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${book_id}/${chapter.index}`
  );
  await fs.mkdirs(
    `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${book_id}/${chapter.index}`
  );

  if (
    !fs.existsSync(
      `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${book_id}/${
        chapter.index
      }/${chapter.content[chapter.content.length - 1].index}.jpg`
    )
  ) {
    for (let content of chapter.content) {
      const writer = fs.createWriteStream(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${book_id}/${chapter.index}/${content.index}.jpg`
      );
      await (async (err) => {
        while (err) {
          try {
            await downloadImage(content.original, writer);
            err = false;
          } catch (error) {
            console.log(error);
            console.log("error in downloading");
          }
        }
      })(true);

      content.original = `https://img.nobles.jp/manga/${book_id}/${chapter.index}/${content.index}-original.jpg`;
      content.content = `https://img.nobles.jp/manga/${book_id}/${chapter.index}/${content.index}.jpg`;
    }
  }

  console.log("done downloading images");
  const { images } = await stichImages(`${book_id}/${chapter.index}`);
  console.log("done sticthing imaages");
  let content_index = 0;
  // return;
  console.log("start ocr google");

  for (let image of images) {
    if (!existsSync(image["buffer_image_translated_location"])) {
      const file = await readFile(image.buffer_image_location);
      let err = true;
      let result;
      while (err) {
        try {
          [result] = await client.documentTextDetection(file);
          err = false;
        } catch (error) {
          await sleep(500);
          console.log(error);
          console.log("error in client");
        }
      }
      console.log("ocr result for ", chapter.index);
      if (result.fullTextAnnotation) {
        const { bounds, contents } = await ocrResultTransform(
          result.fullTextAnnotation.pages,
          feature,
          draw,
          language
        );
        await writeFile(
          image["buffer_image_translated_location"],
          await drawBoxes(bounds, file)
        );
      } else {
        await writeFile(image["buffer_image_translated_location"], file);
      }
    } else {
      console.log("already  exists");
    }
  }
  console.log("unstiching images");
  await unStichImages(
    images,
    `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${book_id}/${chapter.index}`
  );
  console.log("done unstiching images");
}

export async function ocrImage(
  feature: FeatureType,
  draw: boolean = true,
  draw_info?: {
    image: string;
    book_id?: number;
    index?: number;
    chapter_index?: number;
  }
): Promise<ContentEntity[]> {
  const client = new vision.ImageAnnotatorClient({
    credentials: JSON.parse(await readFile("src/cred.json", "utf8")),
  });
  const file_location = `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${draw_info.book_id}/${draw_info.chapter_index}/${draw_info.index}.jpg`;
  const destination = `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${draw_info.book_id}/${draw_info.chapter_index}/${draw_info.index}.jpg`;
  let result;
  let file;
  if (draw) {
    if (
      !fs.existsSync(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${draw_info.book_id}`
      )
    ) {
      await fs.mkdir(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${draw_info.book_id}`
      );
      await fs.mkdir(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${draw_info.book_id}`
      );
    }
    if (
      !fs.existsSync(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${draw_info.book_id}/${draw_info.chapter_index}`
      )
    ) {
      await fs.mkdir(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/temp-comic/${draw_info.book_id}/${draw_info.chapter_index}`
      );
      await fs.mkdir(
        `/media/arifiwamoto/8E7071F37071E27F/Programming/comic/${draw_info.book_id}/${draw_info.chapter_index}`
      );
    }

    const writer = fs.createWriteStream(file_location);
    await downloadImage(draw_info.image, writer);
    file = await readFile(file_location);
    [result] = await client.documentTextDetection(file);
    // while (!result.fullTextAnnotation) {
    //   console.log("error");
    //   [result] = await client.documentTextDetection(file);
    // }
  } else {
    [result] = await client.documentTextDetection(draw_info.image);
    while (!result.fullTextAnnotation) {
      console.log("error");
      [result] = await client.documentTextDetection(draw_info.image);
    }
  }
  if (!result.fullTextAnnotation && draw) {
    await writeFile(destination, await drawBoxes(null, file));
    return null;
  }
  const { bounds, contents } = await ocrResultTransform(
    result.fullTextAnnotation.pages,
    feature,
    draw
  );
  // for (let page of result.fullTextAnnotation.pages) {
  //   for (let block of page.blocks) {
  //     for (let paragraph of block.paragraphs) {
  //       for (let word of paragraph.words) {
  //         sentence += word.symbols.reduce((acc: any, cur: any) => {
  //           return acc + cur.text;
  //         }, "");
  //       }
  //       if (feature === FeatureType.PARAGRAPH) {
  //         // sentence = await modernMtTranslation({
  //         //   q: sentence,
  //         //   source: "ko",
  //         //   target: "en",
  //         // });
  //         contents.push({
  //           original: sentence,
  //           content: "",
  //           type: ContentType.PARAGRAPH,
  //           index: content_index++,
  //         });
  //         if (draw) {
  //           sentence = await modernMtTranslation({
  //             q: sentence,
  //             source: "ko",
  //             target: "en",
  //           });
  //         }
  //         bounds.push({
  //           ...paragraph.boundingBox,
  //           text: sentence,
  //         } as boundEntity);
  //         sentence = "";
  //       }
  //     }
  //     if (feature === FeatureType.BLOCK) {
  //       // sentence = await modernMtTranslation({
  //       //   q: sentence,
  //       //   source: "ko",
  //       //   target: "en",
  //       // });
  //       contents.push({
  //         original: sentence,
  //         content: "",
  //         type: ContentType.PARAGRAPH,
  //         index: content_index++,
  //       });
  //       if (draw) {
  //         sentence = await modernMtTranslation({
  //           q: sentence,
  //           source: "ko",
  //           target: "en",
  //         });
  //       }
  //       bounds.push({
  //         ...block.boundingBox,
  //         text: sentence,
  //       } as boundEntity);
  //       sentence = "";
  //     }
  //     // console.log(sentence);
  //   }
  // }
  if (draw) {
    await writeFile(destination, await drawBoxes(bounds, file));
    return null;
  } else {
    return contents;
  }
}

async function ocrResultTransform(
  pages: any,
  feature: FeatureType,
  draw: boolean,
  language: string = "ko"
): Promise<{ bounds: boundEntity[]; contents: ContentEntity[] }> {
  let sentence = "",
    bounds = [] as boundEntity[],
    contents = [] as ContentEntity[],
    content_index = 1;
  for (let page of pages) {
    for (let block of page.blocks) {
      for (let paragraph of block.paragraphs) {
        for (let word of paragraph.words) {
          sentence += word.symbols.reduce((acc: any, cur: any) => {
            return acc + cur.text;
          }, "");
        }
        if (feature === FeatureType.PARAGRAPH) {
          // sentence = await modernMtTranslation({
          //   q: sentence,
          //   source: "ko",
          //   target: "en",
          // });
          contents.push({
            original: sentence,
            content: "",
            type: ContentType.PARAGRAPH,
            index: content_index++,
          });

          bounds.push({
            ...paragraph.boundingBox,
            text: sentence,
          } as boundEntity);
          sentence = "";
        }
      }
      if (feature === FeatureType.BLOCK) {
        // sentence = await modernMtTranslation({
        //   q: sentence,
        //   source: "ko",
        //   target: "en",
        // });
        contents.push({
          original: sentence,
          content: "",
          type: ContentType.PARAGRAPH,
          index: content_index++,
        });
        bounds.push({
          ...block.boundingBox,
          text: sentence,
        } as boundEntity);
        sentence = "";
      }
      // console.log(sentence);
    }
  }
  if (draw) {
    let translated_sentences: string[] = [];
    translated_sentences = await modernMtTranslation(
      {
        q: sentence,
        source: language,
        target: "en",
      },
      contents.reduce((prev: string[], cur: ContentEntity) => {
        prev.push(cur.original);
        return prev;
      }, [] as string[])
    );
    // if (language === "zh") {
    //   googleTranslateHandler(
    //     contents.reduce((prev: string[], cur: ContentEntity) => {
    //       prev.push(cur.original);
    //       return prev;
    //     }, [] as string[]),
    //     "zh"
    //   );
    // } else if (language === "ko") {
    //   translated_sentences = await modernMtTranslation(
    //     {
    //       q: sentence,
    //       source: "ko",
    //       target: "en",
    //     },
    //     contents.reduce((prev: string[], cur: ContentEntity) => {
    //       prev.push(cur.original);
    //       return prev;
    //     }, [] as string[])
    //   );
    // }

    translated_sentences.forEach((sentence: string, index: number) => {
      contents[index].content = sentence;
      bounds[index].text = sentence;
    });
  }
  return { contents, bounds };
}
