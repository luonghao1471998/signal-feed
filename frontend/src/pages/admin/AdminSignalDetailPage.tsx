import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getSignal } from "@/services/adminPanelService";

type SignalDetail = {
  id: number;
  digest: { id: number; title: string } | null;
  title: string;
  summary: string;
  categories: Array<{ id: number; name: string }>;
  topic_tags: string[];
  source_count: number;
  rank_score: string;
  impact_score: string;
  created_at: string | null;
  sources: Array<{ id: number; x_handle: string; display_name: string | null }>;
  tweets: Array<{ id: number; text: string; url: string; posted_at: string | null }>;
  draft: string | null;
};

const AdminSignalDetailPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<SignalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const response = await getSignal(Number(id)) as { data: SignalDetail };
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Signal Detail</h1>
        <Button asChild variant="outline">
          <Link to="/admin/signals">Back</Link>
        </Button>
      </div>
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white shadow-sm p-5 text-sm">
        <p><strong>Digest:</strong> {data.digest?.title}</p>
        <p><strong>Title:</strong> {data.title}</p>
        <p><strong>Summary:</strong> {data.summary}</p>
        <p><strong>Categories:</strong> {data.categories.map((x) => x.name).join(", ")}</p>
        <p><strong>Topic Tags:</strong> {data.topic_tags.join(", ")}</p>
        <p><strong>Source Count:</strong> {data.source_count}</p>
        <p><strong>Rank Score:</strong> {data.rank_score}</p>
        <p><strong>Impact Score:</strong> {data.impact_score}</p>
        <p><strong>Created At:</strong> {data.created_at}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4">
          <h2 className="mb-2 font-medium">Sources</h2>
          <ul className="space-y-1 text-sm">
            {data.sources.map((source) => (
              <li key={source.id}>{source.display_name || source.x_handle}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4">
          <h2 className="mb-2 font-medium">Tweets</h2>
          <ul className="space-y-2 text-sm">
            {data.tweets.map((tweet) => (
              <li key={tweet.id}>
                <p>{tweet.text}</p>
                {tweet.url && (
                  <a href={tweet.url} className="text-slate-600 hover:text-slate-500 hover:underline" target="_blank" rel="noreferrer">
                    Open tweet
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {data.draft && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4">
          <h2 className="mb-2 font-medium">Draft</h2>
          <p className="text-sm">{data.draft}</p>
        </div>
      )}
    </div>
  );
};

export default AdminSignalDetailPage;
