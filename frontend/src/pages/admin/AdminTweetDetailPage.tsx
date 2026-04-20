import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getTweet } from "@/services/adminPanelService";

type TweetSource = {
  id: number;
  x_handle: string;
  display_name: string | null;
  account_url: string | null;
};

type TweetDetail = {
  id: number;
  tweet_id: string;
  source_id: number;
  source: TweetSource | null;
  text: string;
  url: string;
  posted_at: string | null;
  signal_score: string | number | null;
  is_signal: boolean;
  created_at: string | null;
};

const AdminTweetDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<TweetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const response = await getTweet(Number(id)) as { data: TweetDetail };
        setData(response.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      }
    };
    void load();
  }, [id]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  const src = data.source;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Tweet detail</h1>
        <Button asChild variant="outline">
          <Link to="/admin/tweets">Back</Link>
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 text-sm shadow-sm">
        <p>
          <strong className="text-slate-700">Tweet ID (X):</strong>{" "}
          <span className="font-mono text-slate-900">{data.tweet_id}</span>
        </p>
        <p>
          <strong className="text-slate-700">Source ID:</strong> {data.source_id}
        </p>
        {src && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <p className="font-medium text-slate-800">Source</p>
            <p className="mt-1">
              <strong>Handle:</strong> @{src.x_handle}
            </p>
            <p>
              <strong>Display name:</strong> {src.display_name ?? "—"}
            </p>
            {src.account_url && (
              <p className="mt-1 break-all">
                <strong>Account URL:</strong>{" "}
                <a
                  href={src.account_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  {src.account_url}
                </a>
              </p>
            )}
          </div>
        )}
        <p>
          <strong className="text-slate-700">Posted at:</strong> {data.posted_at ?? "—"}
        </p>
        <p>
          <strong className="text-slate-700">Signal score:</strong> {String(data.signal_score ?? "—")}
        </p>
        <p>
          <strong className="text-slate-700">Is signal:</strong> {data.is_signal ? "Yes" : "No"}
        </p>
        <p>
          <strong className="text-slate-700">Created at:</strong> {data.created_at ?? "—"}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-slate-900">Text</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{data.text}</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-slate-900">URL</h2>
        {data.url ? (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm text-blue-600 underline hover:text-blue-800"
          >
            {data.url}
          </a>
        ) : (
          <p className="text-sm text-slate-500">—</p>
        )}
      </div>
    </div>
  );
};

export default AdminTweetDetailPage;
