"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";
import type { Announcement, Meal } from "@/lib/types";

type Photo = { id: string; url: string };

export default function ContentPage() {
  const { family, loading } = useFamily();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  const load = useCallback(async () => {
    if (!family) return;
    const supabase = createClient();
    const today = format(new Date(), "yyyy-MM-dd");
    const [{ data: m }, { data: a }, { data: p }] = await Promise.all([
      supabase.from("meals").select("*").eq("family_id", family.id).gte("date", today).order("date"),
      supabase.from("announcements").select("*").eq("family_id", family.id).order("created_at", { ascending: false }),
      supabase.from("photos").select("id, url").eq("family_id", family.id).order("created_at", { ascending: false }),
    ]);
    setMeals((m as Meal[]) ?? []);
    setAnnouncements((a as Announcement[]) ?? []);
    setPhotos((p as Photo[]) ?? []);
  }, [family]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveMeal(date: string, title: string) {
    if (!family) return;
    const supabase = createClient();
    if (title.trim()) {
      await supabase
        .from("meals")
        .upsert({ family_id: family.id, date, title: title.trim() }, { onConflict: "family_id,date" });
    } else {
      await supabase.from("meals").delete().eq("family_id", family.id).eq("date", date);
    }
    load();
  }

  async function addAnnouncement() {
    if (!family || !newMessage.trim()) return;
    await createClient().from("announcements").insert({
      family_id: family.id,
      message: newMessage.trim(),
      starts_on: format(new Date(), "yyyy-MM-dd"),
      ends_on: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    });
    setNewMessage("");
    load();
  }

  async function removeAnnouncement(a: Announcement) {
    await createClient().from("announcements").delete().eq("id", a.id);
    load();
  }

  async function uploadPhotos(files: FileList) {
    if (!family) return;
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const path = `${family.id}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${file.name.split(".").pop() ?? "jpg"}`;
      const { error } = await supabase.storage.from("photos").upload(path, file);
      if (error) {
        alert(error.message);
        continue;
      }
      const { data } = supabase.storage.from("photos").getPublicUrl(path);
      await supabase.from("photos").insert({ family_id: family.id, url: data.publicUrl });
    }
    load();
  }

  async function removePhoto(p: Photo) {
    await createClient().from("photos").delete().eq("id", p.id);
    load();
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  const mealByDate = new Map(meals.map((m) => [m.date, m]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-800">Board content</h1>
        <p className="text-sm text-slate-500">Dinner plans, announcements and screensaver photos for the kitchen board.</p>
      </header>

      <section className="card">
        <h2 className="mb-3 font-display text-lg font-bold text-slate-800">🍽️ What&apos;s for dinner</h2>
        <div className="space-y-2">
          {days.map((d) => {
            const date = format(d, "yyyy-MM-dd");
            const meal = mealByDate.get(date);
            return (
              <div key={date} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-bold text-slate-500">{format(d, "EEE MMM d")}</span>
                <input
                  className="input"
                  placeholder="e.g. Taco night"
                  defaultValue={meal?.title ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (meal?.title ?? "")) saveMeal(date, e.target.value);
                  }}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">Changes save when you click away from a field.</p>
      </section>

      <section className="card">
        <h2 className="mb-3 font-display text-lg font-bold text-slate-800">📣 Announcements</h2>
        <div className="mb-3 flex gap-2">
          <input
            className="input"
            placeholder="Grandma arrives Saturday!"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAnnouncement()}
          />
          <button className="btn shrink-0" onClick={addAnnouncement}>Post</button>
        </div>
        <ul className="divide-y divide-slate-100">
          {announcements.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2">
              <span className="text-xl">{a.emoji}</span>
              <span className="flex-1 text-sm font-semibold text-slate-700">{a.message}</span>
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                onClick={() => removeAnnouncement(a)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
          {announcements.length === 0 && <li className="py-2 text-sm text-slate-400">Nothing posted.</li>}
        </ul>
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-800">🖼️ Screensaver photos</h2>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <button className="btn" onClick={() => fileInput.current?.click()}>
            <Upload size={16} /> Upload
          </button>
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-slate-400">
            No photos yet. When the board is idle it becomes a family photo frame.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button
                  className="absolute right-1 top-1 hidden rounded-lg bg-black/60 p-1.5 text-white group-hover:block"
                  onClick={() => removePhoto(p)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
