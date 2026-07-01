/*
  Warnings:

  - A unique constraint covering the columns `[video_id]` on the table `capelas` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "capelas_video_id_key" ON "capelas"("video_id");
