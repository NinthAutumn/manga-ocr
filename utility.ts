import { promisify } from "util";
import * as fs from "fs";
import { VolumeEntity } from "./models";
import { TextChannel } from "discord.js";
import * as Discord from "discord.js";
import Axios from "axios";
require("dotenv").config();
export function chunk(array: Array<any>, size: number): Array<Array<any>> {
  const chunked_arr = new Array<any>();
  for (let i = 0; i < array.length; i++) {
    const last = chunked_arr[chunked_arr.length - 1];
    if (!last || last.length === size) {
      chunked_arr.push([array[i]]);
    } else {
      last.push(array[i]);
    }
  }
  return chunked_arr;
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const writeFile = promisify(fs.writeFile);
export const readFile = promisify(fs.readFile);

export function volumeFilterUpdate(
  volumes: VolumeEntity[],
  volume_index: number,
  chapter_count: number,
  volume_id: number
): VolumeEntity[] {
  const count = volumes.reduce((acc: any, cur: VolumeEntity) => {
    acc += cur.chapters.length;
    return acc;
  }, 0);
  if (count <= chapter_count) {
    return;
  }
  let new_volumes;
  if (volumes[volume_index - 1]) {
    volumes[volume_index - 1].id = volume_id;
    volumes.splice(0, volume_index - 1);
    let chapter_index = 1;
    new_volumes = volumes.map((volume) => {
      volume.chapters = volume.chapters.filter((chapter) => {
        return chapter_index++ > chapter_count;
      });
      return volume;
    });
  } else {
    let chapter_index = 1;
    new_volumes = volumes.filter((volume) => {
      return volume.chapters.find((item) => {
        return chapter_index++ > chapter_count;
      });
    });
    chapter_index = 1;
    new_volumes = new_volumes.map((volume) => {
      volume.chapters = volume.chapters.filter((chapter, index) => {
        return chapter_index++ > chapter_count;
      });
      return volume;
    });
    new_volumes[0].id = volume_id;
    new_volumes[0].index = volume_index;
  }
  return new_volumes;
}

export async function notifyNovel(book_id: number) {
  let bot = new Discord.Client();
  const book = (
    await Axios.get(
      `https://api.jpmtl.com/api/mtl/book/${book_id}/withoutChapter`
    )
  ).data;
  bot.on("ready", async () => {
    await (
      bot.guilds.cache
        .get("684133553042096148")
        .channels.cache.find((ch) => ch.name == "latest-novels") as TextChannel
    ).send(
      `${book.title} has been translated: \nhttps://jpmtl.com/books/${book.id}`
    );
    await bot.destroy();
  });
  bot.login(process.env.DISCORD_TOKEN);
}
