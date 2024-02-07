package it.cnr.isti.visione.lucene;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import org.apache.lucene.analysis.core.WhitespaceAnalyzer;
import org.apache.lucene.document.Document;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.Term;
import org.apache.lucene.index.Terms;
import org.apache.lucene.index.TermsEnum;
import org.apache.lucene.queryparser.classic.ParseException;
import org.apache.lucene.queryparser.classic.QueryParser;
import org.apache.lucene.search.BooleanQuery;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.QueryRescorer;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;
import org.apache.lucene.search.similarities.BM25Similarity;
import org.apache.lucene.search.similarities.ClassicSimilarity;
import org.apache.lucene.search.similarities.Similarity;
import org.apache.lucene.store.FSDirectory;
import org.apache.lucene.store.NIOFSDirectory;
import org.apache.lucene.util.BytesRef;

import it.cnr.isti.visione.logging.Tools;
import it.cnr.isti.visione.services.CLIPExtractor;
import it.cnr.isti.visione.services.CLIPOneExtractor;
import it.cnr.isti.visione.services.FieldParameters;
import it.cnr.isti.visione.services.ObjectQueryPreprocessing;
import it.cnr.isti.visione.services.SearchResults;
import it.cnr.isti.visione.services.Settings;
import it.cnr.isti.visione.services.VisioneQuery;


public class LucTextSearch {

	private static final Object semaphore = new Object();

	//Because QueryParser is not thread safe
	private final Object queryParserSemaphore = new Object();

	public IndexSearcher s;
	private IndexReader ir;

	private QueryParser parser;

	private Similarity dotProduct = new DotProduct();
	private Similarity cosineSimilarity = new CosineSimilarity2();
	private Similarity classicSimilarity = new ClassicSimilarity();
	private Similarity bm25Similarity = new BM25Similarity();
	private Similarity dotProductRescaled = new DotProductRescaled();

	private double similarityRescorerWeight = 10000;
	private HashMap<String, Similarity> fieldSimilaties = new HashMap<>();
	private static 	ObjectQueryPreprocessing objectPreprocessing;

	public void openSearcher(String lucenePath) throws IOException {
		synchronized (semaphore) {
			if (ir == null) {
				Path absolutePath = Paths.get(lucenePath, "");
				FSDirectory index = NIOFSDirectory.open(absolutePath);
//				FSDirectory index = new MMapDirectory(absolutePath, 60000000);
				ir = DirectoryReader.open(index);
			}
		}
		s = new IndexSearcher(ir);

		// Lucene cache

//		final int maxNumberOfCachedQueries = 256;
//		   final long maxRamBytesUsed = 2000 * 1024L * 1024L; // 50MB
//		   // these cache and policy instances can be shared across several queries and readers
//		   // it is fine to eg. store them into static variables
//		   final QueryCache queryCache = new LRUQueryCache(maxNumberOfCachedQueries, maxRamBytesUsed);
//		   final QueryCachingPolicy defaultCachingPolicy = new UsageTrackingQueryCachingPolicy();
//		   s.setQueryCache(queryCache);
//		   s.setQueryCachingPolicy(defaultCachingPolicy);

		// end Lucene cache

		s.setSimilarity(classicSimilarity);
		fieldSimilaties.put("CosineSimilarity", cosineSimilarity);
		fieldSimilaties.put("BM25", bm25Similarity);
		fieldSimilaties.put("DotProduct", dotProduct);
		fieldSimilaties.put("TFIDF", classicSimilarity);
		fieldSimilaties.put("DotProductRescaled", dotProductRescaled);

		BooleanQuery.setMaxClauseCount(30000);

		parser = new QueryParser(Fields.TXT, new WhitespaceAnalyzer());
	}

	public static void setPreprocessing(ObjectQueryPreprocessing preprocessing) {
		objectPreprocessing = preprocessing;
	}

	private LRUCache<Integer, TopDocs> luceneCache = new LRUCache<>(10);

	public SearchResults[] search(VisioneQuery query, int k) throws ParseException, IOException {
//		query in AND
//		String occur = "+";
//		test con OR
		TopDocs hits = null;
		int kQuery = 1800000;

		String occur = "";
		int pipelineIdx = 0;
		long time = -System.currentTimeMillis();

		String query4Cache = "";

		for (int i = 0; i < Settings.RESCORER_PIPELINE_FIELDS.length; i++) {
			if (i == (Settings.RESCORER_PIPELINE_FIELDS.length - 1) || query.getQuery().size() == 1) {
				kQuery = k;
//				occur = "";
			}

			FieldParameters field = Settings.RESCORER_PIPELINE_FIELDS[i];
			String fieldName = field.getField();

			String value = query.getQuery().get(fieldName);
			// System.out.println(fieldName + ": " + value);
			if (value == null)
				continue;

//			value = value.replaceAll("\\(", "\\\\(").replaceAll("\\)", "\\\\)");


				s.setSimilarity(fieldSimilaties.get(field.getSimilarity()));

				if (fieldName.equals("aladin"))
					occur = "";
				else {
//					occur = query.get("occur");
					if (query.getParameters().get("occur").equals("and"))
						occur = "+";
				}


				String booleanQuery = "";
				Query luceneQuery = null;

				if (fieldName.equals(Fields.OBJECTS)) {
					booleanQuery = objectPreprocessing.processingLucene(value.trim(), Fields.OBJECTS, occur);
				} else {
					booleanQuery = value.trim();
					booleanQuery = booleanQuery.replaceAll(" ", " " + occur + fieldName + ":");
					booleanQuery = occur + fieldName + ":" + booleanQuery;
//					int minusIdx = value.indexOf("-");
//					if (minusIdx < 0) {
//						booleanQuery = value.trim();
//						booleanQuery = booleanQuery.replaceAll(" ", " " + occur + fieldName + ":");
//						booleanQuery = occur + fieldName + ":" + booleanQuery;
//					} else {
//						String query1 = value.substring(0, minusIdx).trim();
//						if (!query1.equals("")) {
//							booleanQuery = query1.replaceAll(" ", " " + occur + fieldName + ":");
//							booleanQuery = occur + fieldName + ":" + booleanQuery;
//						}
//						String query2 = value.trim().substring(minusIdx).replaceAll("-", "") + " ";
//						if (fieldName.equals(Fields.OBJECTS))
//							query2 = query2.replaceAll("(?<![0-9]) ", "1 ").trim();
//						query2 = query2.trim().replaceAll(" ", " " + "-" + fieldName + ":");
//						query2 = "-" + fieldName + ":" + query2;
//						booleanQuery += " " + query2;
//					}
				}

				booleanQuery = booleanQuery.replaceAll("\\(", "\\\\(").replaceAll("\\)", "\\\\)");

				// System.out.println(booleanQuery);

				query4Cache += booleanQuery;
				if (luceneCache.containsKey(query4Cache.hashCode())) {
					hits = luceneCache.get(query4Cache.hashCode());
					System.out.println("\t [lucene query from cache]");
				} else {
					synchronized (queryParserSemaphore) {
						luceneQuery = parser.parse(booleanQuery);
					}

					// System.out.println(luceneQuery);

					if (pipelineIdx == 0) {
						time = -System.currentTimeMillis();
						// System.out.println(luceneQuery);
						hits = s.search(luceneQuery, kQuery);
						hits.totalHits = hits.scoreDocs.length;
						time += System.currentTimeMillis();
						try {
							System.out.println("\t **Search " + fieldName + " (k: " + kQuery + ")" + ":\t" + time + " ms" + "\t\t(nHits " + hits.totalHits + "---maxScore " + hits.scoreDocs[0].score + ")");
						} catch (Exception e) {
							e.printStackTrace();
						}
						} else {

						if (hits.totalHits > 0) {
	//						System.out.println(luceneQuery.toString() + ": " + field.getWeight() + " k: " + kQuery);
							time = -System.currentTimeMillis();
							float firstPassScore = 1.0f;
							if (fieldName.equals(Fields.ALADIN)) {
								firstPassScore /= hits.scoreDocs[0].score;
								// kQuery = k;
							}
							hits = myrescore(s, hits, luceneQuery, firstPassScore, field.getWeight(), kQuery);
							// QueryRescorer.rescore(s, hits, luceneQuery, field.getWeight(), kQuery);//
							hits.totalHits = hits.scoreDocs.length;

							time += System.currentTimeMillis();
							System.out.println("\t \t**Rescore " + fieldName + " (" + "weight:" + field.getWeight() + " k: "
									+ kQuery + "):\t" + time + " ms" + "\t\t(nHits " + hits.totalHits + "---maxScore "
									+ hits.scoreDocs[0].score + ")");

						} else {
							System.out.println("no query result!");
							break;
						}

					}
					//luceneCache.put(query4Cache, topDocsClone(hits));
					luceneCache.put(query4Cache.hashCode(), hits);//LUCIA
				}

			pipelineIdx++;
		}

		return topDocs2SearchResults(hits, k);
	}

	private TopDocs topDocsClone(TopDocs topdocs, int maxRes) {
		ScoreDoc[] scoreDocs = topdocs.scoreDocs;
		ScoreDoc[] scoreDocsClone = new ScoreDoc[Math.min(scoreDocs.length, maxRes)];

		int totalHits = 0;
		for (int i = 0; i < scoreDocs.length && i < maxRes; i++) {
			scoreDocsClone[i] = new ScoreDoc(scoreDocs[i].doc, scoreDocs[i].score);
			totalHits++;
		}
		//ScoreDoc[] scoreDocClone = Arrays.asList(topdocs.scoreDocs).stream().collect(Collectors.toList()).toArray(new ScoreDoc[topdocs.scoreDocs.length]);

		TopDocs clone = new TopDocs(totalHits, scoreDocsClone, topdocs.getMaxScore());

		return clone;
	}

	public TopDocs myrescore(IndexSearcher searcher, TopDocs topDocs, Query query, final float weightFirstPass,
			final double weightSecondPass, int topN) throws IOException {
		return new QueryRescorer(query) {
			@Override
			protected float combine(float firstPassScore, boolean secondPassMatches, float secondPassScore) {
				float score = firstPassScore * weightFirstPass;
				if (secondPassMatches) {
					score += weightSecondPass * secondPassScore;
				}
				return score;
			}
		}.rescore(searcher, topDocs, topN);
	}

	public SearchResults[] topDocs2SearchResults(TopDocs hits, int k) throws IOException {
		if (hits == null)
			return new SearchResults[0];

		long elapsed = -System.currentTimeMillis();
		SearchResults[] results = Arrays.stream(hits.scoreDocs)
			.limit(k)
			.parallel()
			.map(sd -> new SearchResults(sd))
			.toArray(SearchResults[]::new);
		elapsed += System.currentTimeMillis();
		System.out.println("***topDocs2SearchResults: "+ elapsed + "ms" + "\t res size:" + results.length);
		return results;
	}

	public SearchResults[] topDocs2SearchResults(TopDocs hits) throws IOException {
		return topDocs2SearchResults(hits, hits.scoreDocs.length);
	}

	public SearchResults[] searchByID(String query, int k, TopDocs hits) throws ParseException, IOException {
//		String[] queries = query.toLowerCase().split(Settings.QUERY_SPLIT);

		System.out.println("vf: " + query);
		if (query == null)
			return null;

		String visualFeatures = getTerms(query, Fields.VISUAL_FEATURES, true).trim();
//		String visualFeatures = get(query, Fields.VISUAL_FEATURES);
		SearchResults[] res = searchByExample(visualFeatures, k, hits);
//		System.out.println(visualFeatures);
		return res;
	}

	public SearchResults[] searchByALADINid(String query, int k, TopDocs hits) throws ParseException, IOException {
//		String[] queries = query.toLowerCase().split(Settings.QUERY_SPLIT);
		System.out.println("aladinID: " + query);
		if (query == null)
			return null;
		String visualFeatures = getTerms(query, Fields.ALADIN, true).trim();
//		String visualFeatures = get(query, Fields.ALADIN + "_vector");

		TopDocs res = searchByALADIN(visualFeatures, k, hits);
//		System.out.println(visualFeatures);
		SearchResults[] results = topDocs2SearchResults(res, k);
		return results;
	}

	public SearchResults[] searchByExample(String visualFeatures, int k, TopDocs hits) throws ParseException, IOException {
		// s.setSimilarity(dotProduct);
		Similarity sim = fieldSimilaties.get(Settings.FIELD_PARAMETERS_MAP.get("IMG_SIM").getSimilarity());

		s.setSimilarity(sim);
		String occur = "";

		TopDocs simHits = null;
		String booleanQuery = occur + Fields.VISUAL_FEATURES + ":"
				+ visualFeatures.replaceAll(" ", " " + occur + Fields.VISUAL_FEATURES + ":");
//		System.out.println(booleanQuery);
		Query luceneQuery = null;
		long qptime = -System.currentTimeMillis();
		synchronized (queryParserSemaphore) {
			luceneQuery = parser.parse(booleanQuery);
		}
		qptime += System.currentTimeMillis();
		System.out.println("img sim qptime: " + qptime + " ms");
		if (hits == null) {
			long time = -System.currentTimeMillis();
			simHits = s.search(luceneQuery, k);
			time += System.currentTimeMillis();
			System.out.println("Search time: " + time + " ms");
		} else {
//			simHits = QueryRescorer.rescore(s, hits, luceneQuery, similarityRescorerWeight, k);
			ScoreDoc[] scoredocs = new ScoreDoc[hits.scoreDocs.length];
			for (int i = 0; i < hits.scoreDocs.length; i++) {
				scoredocs[i] = new ScoreDoc(hits.scoreDocs[i].doc, 0);
			}
//			simHits = QueryRescorer.rescore(s, new TopDocs(hits.totalHits, scoredocs), luceneQuery, similarityRescorerWeight, k);

			simHits = QueryRescorer.rescore(s, new TopDocs(hits.totalHits, scoredocs, hits.getMaxScore()), luceneQuery,
					similarityRescorerWeight, k);
//			simHits = QueryRescorer.rescore(s, hits, luceneQuery, similarityRescorerWeight, k);
		}

		SearchResults[] results = topDocs2SearchResults(simHits, k);
		return results;
	}

	public TopDocs searchByALADIN(String visualFeatures, int k, TopDocs hits) throws ParseException, IOException {
		Similarity sim = fieldSimilaties.get(Settings.FIELD_PARAMETERS_MAP.get("IMG_SIM").getSimilarity());
		s.setSimilarity(sim);

		String occur = "";

		TopDocs simHits = null;
		String booleanQuery = occur + Fields.ALADIN + ":"
				+ visualFeatures.replaceAll(" ", " " + occur + Fields.ALADIN + ":");
		//System.out.println(booleanQuery);
		Query luceneQuery = null;
		long qptime = -System.currentTimeMillis();
		synchronized (queryParserSemaphore) {
			luceneQuery = parser.parse(booleanQuery);
		}
		qptime += System.currentTimeMillis();
		System.out.println("** ALADIN qptime: " + qptime + " ms");
		if (hits == null) {
			long time = -System.currentTimeMillis();
			simHits = s.search(luceneQuery, k);
			time += System.currentTimeMillis();
			System.out.println("** ALADIN Search time: " + time + " ms");
		} else {
			ScoreDoc[] scoredocs = new ScoreDoc[hits.scoreDocs.length];
			for (int i = 0; i < hits.scoreDocs.length; i++) {
				scoredocs[i] = new ScoreDoc(hits.scoreDocs[i].doc, 0);
			}
//			simHits = QueryRescorer.rescore(s, new TopDocs(hits.totalHits, scoredocs), luceneQuery, similarityRescorerWeight, k);
			simHits = QueryRescorer.rescore(s, new TopDocs(hits.totalHits, scoredocs, hits.getMaxScore()), luceneQuery,
					similarityRescorerWeight, k);

			// simHits = QueryRescorer.rescore(s, hits, luceneQuery,
			// similarityRescorerWeight, k);
		}

		return simHits;
	}


	public String getTerms(String id, String field, boolean boosting) throws IOException {
//		System.out.println(id + ", " + field);
		Query q = new TermQuery(new Term(Fields.IMG_ID, id));
		String terms = null;
		TopDocs td = s.search(q, 1);
//			if (td.totalHits.value > 0) {
		if (td.totalHits > 0) {
			terms = s.doc(td.scoreDocs[0].doc).get(field);
			if (terms == null)
				terms = getTerms(ir.getTermVector(td.scoreDocs[0].doc, field), boosting);
		}
		return terms;
	}

	public String get(String id, String field) throws IOException {
//		System.out.println(id + ", " + field);
		Query q = new TermQuery(new Term(Fields.IMG_ID, id));
		String data = null;
		TopDocs td = s.search(q, 1);
//			if (td.totalHits.value > 0) {
		if (td.totalHits > 0) {
			Document doc = s.doc(td.scoreDocs[0].doc);
			data = doc.get(field);
		}
		return data;
	}

	public List<String> getAllVideoKeyframes(String videoId) throws ParseException, IOException {
		String booleanQuery = "+" + Fields.IMG_ID + ":"	+ videoId + "*";
		Query luceneQuery = null;
		synchronized (queryParserSemaphore) {
			luceneQuery = parser.parse(booleanQuery);
		}
		// System.out.println(luceneQuery);

		TopDocs hits = s.search(luceneQuery, 10000);
		List<String> response = new ArrayList<>();
		List<String[]> keyframes = new ArrayList<>();
		for (int i = 0; i <= hits.scoreDocs.length-1; i++) {
			Document document = s.doc(hits.scoreDocs[i].doc);
			String imgID = document.get(Fields.IMG_ID);
			String middleTime = document.get(Fields.MIDDLE_TIME);
			String[] res = {imgID, middleTime};
			keyframes.add(res);
		}

		//Collections.sort(keyframes, new Tools().new Comp());
		Collections.sort(keyframes, new Tools().new Comp());

		for (String[] kf: keyframes)
			response.add(kf[0]);

		return response;
	}

	public String get(int docID, String field) throws IOException {
		return s.doc(docID).get(field);
	}

	private String getTerms(Terms terms, boolean boosting) throws IOException {
		StringBuilder resultTerms = new StringBuilder();
		if (terms != null) {
			TermsEnum termsEnum = terms.iterator();
			BytesRef br;
			while ((br = termsEnum.next()) != null) {
				short fr = (short) termsEnum.totalTermFreq();
//				resultTerms.append(br.utf8ToString()).append("^").append(fr).append(" ");
				// temporary
				if (boosting) {
					resultTerms.append(br.utf8ToString()).append("^").append(fr).append(" ");
				} else {
					for (short freq = 0; freq < fr; freq++) {
						resultTerms.append(br.utf8ToString()).append(" ");
					}
				}

			}
		}

		return resultTerms.toString();
	}

	public class EntrySearchResultsComparator implements Comparator<Entry<Integer, SearchResults>> {
		@Override
		public int compare(Entry<Integer, SearchResults> o1, Entry<Integer, SearchResults> o2) {
			return -((Float) o1.getValue().score).compareTo((Float) o2.getValue().score);
		}
	};

	public class EntryScoreDocComparator implements Comparator<Entry<Integer, ScoreDoc>> {
		@Override
		public int compare(Entry<Integer, ScoreDoc> o1, Entry<Integer, ScoreDoc> o2) {
			return -((Float) o1.getValue().score).compareTo((Float) o2.getValue().score);
		}
	};

	public class SearchResultsComparator implements Comparator<SearchResults> {
		@Override
		public int compare(SearchResults o1, SearchResults o2) {
			return -((Float) o1.score).compareTo((Float) o2.score);
		}
	}

	public class ScoreDocsComparator implements Comparator<ScoreDoc> {
		@Override
		public int compare(ScoreDoc o1, ScoreDoc o2) {
			return -((Float) o1.score).compareTo((Float) o2.score);
		}
	}

	public ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> getVideoHashMap_th(SearchResults[] hits,
			int quantizer, Set<String> video_keys) throws NumberFormatException, IOException {
		ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> hm = new ConcurrentHashMap<>();
		int nDocs = hits.length;
		int bookedThreads = Runtime.getRuntime().availableProcessors() - 1;
		final int nObjsPerThread = (int) Math.ceil((double) nDocs / (bookedThreads));
		final int nThread = (int) Math.ceil((double) nDocs / nObjsPerThread);

		int ti = 0;
		Thread[] thread = new Thread[nThread];

		if (video_keys == null) {
			for (int from = 0; from < nDocs; from += nObjsPerThread) {
				int to = from + nObjsPerThread - 1;
				if (to >= nDocs)
					to = nDocs - 1;
				thread[ti] = new Thread(new VideoHashMapThread(hits, from, to, hm, quantizer));
				thread[ti].start();
				ti++;
			}
		} else {
			for (int from = 0; from < nDocs; from += nObjsPerThread) {
				int to = from + nObjsPerThread - 1;
				if (to >= nDocs)
					to = nDocs - 1;
				thread[ti] = new Thread(new SelectedVideoHashMapThread(hits, from, to, hm, video_keys, quantizer));
				thread[ti].start();
				ti++;
			}
		}

		for (Thread t : thread) {
			if (t != null)
				try {
					t.join();
				} catch (InterruptedException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
		}
		return hm;

	}

	public class VideoHashMapThread implements Runnable {
		private final int from;
		private final int to;
		private final SearchResults[] hits;
		private final ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> hm;
		private final int quantizer;
		private final Object sem = new Object();

		public VideoHashMapThread(SearchResults[] hits, int from, int to,
				ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> hm, int quantizer) {
			this.from = from;
			this.to = to;
			this.hits = hits;
			this.hm = hm;
			this.quantizer = quantizer;

		}

		@Override
		public void run() {
			for (int iO = from; iO <= to; iO++) {
				try {
					SearchResults sr=hits[iO];
					float score = sr.score;
					float timestamp = sr.getMiddleTime()/1000.0f;// this is in millisecond
					String videoId = sr.getVideoId();
					Integer id_quantized_timestamp = (int) (timestamp / (quantizer)); // quantize timestamp
					hm.putIfAbsent(videoId, new ConcurrentHashMap<Integer, SearchResults>());
					ConcurrentHashMap<Integer, SearchResults> keyframes = hm.get(videoId); // video keyframes (one for each quantized time interval)
					keyframes.putIfAbsent(id_quantized_timestamp, sr);
					SearchResults representative_keyframe = keyframes.get(id_quantized_timestamp);
					if (representative_keyframe.score > score)
						continue; // We keep just one keyframe for each quantized time interval

					synchronized (sem) {
						keyframes = hm.get(videoId);
						if( keyframes.get(id_quantized_timestamp).score<score) {
							keyframes.put(id_quantized_timestamp, sr);
							hm.put(videoId, keyframes);
						}
					}


				} catch (Exception e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}
		}
	}

	public class SelectedVideoHashMapThread implements Runnable {
		private final int from;
		private final int to;
		private final SearchResults[] hits;
		private final ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> hm;
		private final int quantizer;
		private final Set<String> video_keys;
		private final Object sem = new Object();

		public SelectedVideoHashMapThread(SearchResults[] hits, int from, int to,
				ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> hm, Set<String> video_keys,
				int quantizer) {
			this.from = from;
			this.to = to;
			this.hits = hits;
			this.hm = hm;
			this.quantizer = quantizer;
			this.video_keys = video_keys;

		}

		@Override
		public void run() {
			for (int iO = from; iO <= to; iO++) {
				try {
					SearchResults sr=hits[iO];
					float score = sr.score;

					String videoId = sr.getVideoId();
					if (!video_keys.contains(videoId))
						continue;
					float timestamp = sr.getMiddleTime()/1000.0f;// this is in millisecond
					Integer id_quantized_timestamp = (int) (timestamp / quantizer); // quantize timestamp

					hm.putIfAbsent(videoId, new ConcurrentHashMap<Integer, SearchResults>());
					ConcurrentHashMap<Integer, SearchResults> keyframes = hm.get(videoId); // video keyframes (one for each quantized time interval)
					keyframes.putIfAbsent(id_quantized_timestamp, sr);
					SearchResults representative_keyframe = keyframes.get(id_quantized_timestamp);
					if (representative_keyframe.score > score)
						continue; // We keep just one keyframe for each quantized time interval

					synchronized (sem) {
						keyframes = hm.get(videoId);
						if( keyframes.get(id_quantized_timestamp).score<score) {
							keyframes.put(id_quantized_timestamp, sr);
							hm.put(videoId, keyframes);

						}
					}
				} catch (Exception e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}

		}
	}



	public ConcurrentMap<String, ConcurrentMap<Integer, SearchResults>> getVideoHashMap(SearchResults[] hits, int quantizer, Set<String> videoKeys) {
		Map<String, ConcurrentMap<Integer, SearchResults>> hashedHits = Arrays.stream(hits)  // get hits as a stream
			.parallel()  // run in parallel
			.filter(sr -> videoKeys == null || videoKeys.contains(sr.getVideoId()))  // filter out hits not belonging to selected videos
			.collect(
				Collectors.groupingByConcurrent(  // group search results ...
					sr -> sr.getVideoId(),  // .. by videoId, generates a Map<String, List<SearchResults>>
					Collectors.toConcurrentMap(  // map each List<SearchResults> to a Map<Integer, SearchResults> ...
						sr -> (int) (sr.getMiddleTime() / (quantizer*1000)), // ... using qauntized timestamp as key ...
						sr -> sr,  // ... and SearchResults as value (identity function) ...
						(sr1, sr2) -> sr1.score > sr2.score ? sr1 : sr2  // ... and merge SearchResults with same key by keeping the one with highest score
					)
				)
			);

		// XXX: this is here to adhere to the old interface, check if it is still needed
		return new ConcurrentHashMap<>(hashedHits);
	}

	public SearchResults[] sortByVideo(SearchResults[] results, int n_frames_per_row, int maxRes) {
		if (results == null)
			return null;

		long totalTime = -System.currentTimeMillis();

		SearchResults[] sortedResults = Stream.of(results) // get results as a stream
			.limit(maxRes) // limit to at most maxRes results
			.collect(Collectors.groupingBy(r -> r.getVideoId())) // group by videoId, creates a Map<String, List<SearchResults>>
			.values() // get the values of the map, i.e., a List<SearchResults>
			.parallelStream().map(videoResults -> { // sort and limit each SearchResults
				videoResults.sort(new SearchResultsComparator());
				return videoResults.subList(0, Math.min(n_frames_per_row, videoResults.size()));
			})
			.sorted((r1, r2) -> -Float.compare(r1.get(0).score, r2.get(0).score)) // sort the lists of SearchResults by the score of the first element
			.flatMap(List::stream) // flatten the list of lists to a single list
			.collect(Collectors.toList()) // collect the list
			.toArray(new SearchResults[0]); // convert to array

		totalTime += System.currentTimeMillis();
		System.out.println("**sortByVideo: ("+maxRes +" maxRes) " + totalTime + "ms" + "\t res size:" + sortedResults.length);

		return sortedResults;

	}

	public SearchResults[] mergeResults(List<SearchResults[]> resultsList, int topK, boolean temporalQuery, String fusionMode) throws NumberFormatException, IOException {
		resultsList = resultsList.stream().filter(x -> x != null).collect(Collectors.toList());
		int nRankings = resultsList.size();
		if (nRankings == 0) return null;
		if (nRankings == 1) { // no fusion needed, just return the topK results
			SearchResults[] topKResults = resultsList.get(0);
			if (topKResults.length > topK) topKResults = Arrays.copyOfRange(topKResults, 0, topK);
			return topKResults;
		}

		// nRankings > 1
		if (temporalQuery)
			 return combineResults_temporal(resultsList, topK, 3, 12);
			 //note: temporal combination using RRF scores instead of normalized scores semmes to work worse

		// if (fusionMode.toLowerCase().equals("rrf"))
		// return mergeResultsRRF(topDocsList, topK, temporalquery);

		// //if (fusionMode.toLowerCase().equals("rrf_with_boost"))
		return mergeResultsRRFwithBoostTopN(resultsList, topK);
	}

	private SearchResults[] combineResults_temporal(List<SearchResults[]> resultsList, int k, int timeQuantizer, float timeInterval)
			throws NumberFormatException, IOException {
		int nListsToMerge = resultsList.size();
		long totalTime = -System.currentTimeMillis();
		int qi = Math.round(timeInterval / (float) timeQuantizer); // used for searching quantized interval
		float maxScores[] = new float[nListsToMerge];

		long time = -System.currentTimeMillis();
		// Collections.sort(resultsList, new Comparator<SearchResults[]>() {
		// 	@Override
		// 	public int compare(SearchResults[] o1, SearchResults[] o2) {
		// 		return Long.compare(o1.length, o2.length);
		// 	}
		// });

		ConcurrentMap<String, ConcurrentMap<Integer, SearchResults>>[] shmap = new ConcurrentHashMap[nListsToMerge];
		//ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>>[] shmap = new ConcurrentHashMap[nListsToMerge];
		Set<String> videoIds = null;
		for (int i = 0; i < nListsToMerge; i++) {
			SearchResults[] hits_i = resultsList.get(i);
			shmap[i] = getVideoHashMap(hits_i, timeQuantizer, videoIds); // hashing  hits_i
			//TODO add a cache for the hashing?
			if(i==0)
				videoIds = shmap[i].keySet();
			else
				videoIds.retainAll(shmap[i].keySet()); // videoIds is already the intersection of the videos
			//videoIds.addAll(shmap[i].keySet()); //video ids is the union
			maxScores[i] = hits_i[0].score;
			System.out.print("[list"+i+":" + hits_i.length+" max_score:"+maxScores[i]+"]\n");
		}
		time += System.currentTimeMillis();
		System.out.print("**TEMPORAL MERGE: [hashing:" + time + "ms], ");

		// matching
		time = -System.currentTimeMillis();
		ArrayList<SearchResults> resultsSD = new ArrayList<>();
		for (String videoId : videoIds) {
			ConcurrentMap<Integer, SearchResults>[] hm = new ConcurrentHashMap[nListsToMerge];
			for (int i = 0; i < nListsToMerge; i++) {
				hm[i] = shmap[i].get(videoId);
			}

			List<Entry<Integer, SearchResults>> listOfEntries0 = new ArrayList(hm[0].entrySet());
			Collections.sort(listOfEntries0, new EntrySearchResultsComparator()); // sort first list using score

			HashSet<Integer> idResTime = new HashSet<Integer>(); // one result for each
			HashSet<String> idResKeyframe = new HashSet<String>(); // one result for each
			for (Entry<Integer, SearchResults> k0 : listOfEntries0) { // entries of the first hits (ranked by highest score)
				Integer id_t0 = k0.getKey();
				if (idResTime.contains(id_t0))
					continue;

				SearchResults[] best_sr = new SearchResults[nListsToMerge];
				Integer best_id_t[] = new Integer[nListsToMerge];
				best_sr[0] = k0.getValue();
				best_id_t[0] = id_t0;
				float aggregated_score = best_sr[0].score / maxScores[0]; /// max_scores[0]

				for (int i = 1; i < nListsToMerge; i++) {
					best_sr[i] = null;
					float best_score = -1;

					for (int interval = 0; interval < qi + 1; interval++) {
						// searching a match in the i-th list
						Integer id_t_i = id_t0 + interval;
						SearchResults sr_i = hm[i].get(id_t_i); // matching keyframe
						if (sr_i == null || idResTime.contains(id_t_i))
							continue;
						float score = // sr_i.score* aggregated_score; //geometric mean without sqrt(since sqrt is
										// monotonic)
								// 2*(sr_i.score* aggregated_score)/(sr_i.score+ aggregated_score); //harmonic
								// mean
								sr_i.score / maxScores[i] + aggregated_score; // arithmetic mean NOTE: you should
																				// normalize the score in the hashmap!!
						// (float) ((Math.exp(1+sr_i.score)+ Math.exp(1+aggregated_score)));
						if (score > best_score) {
							best_score = score;
							best_sr[i] = sr_i;
							best_id_t[i] = id_t_i;
						}
					}

					if (best_sr[i] == null) {
						break;// no match
					}
					aggregated_score = best_score;
				}

				if (best_sr[nListsToMerge - 1] != null) { // we have a match
					for (int i = 0; i < nListsToMerge; i++) {
						SearchResults ss = best_sr[i];
						String imgID = ss.getImgId();
						if (idResKeyframe.contains(imgID)) {
							continue;
						}
						SearchResults ssNew = new SearchResults(ss);
						ssNew.score = aggregated_score;

						resultsSD.add(ssNew);
						idResKeyframe.add(imgID);
						idResTime.add(best_id_t[i]);
					}

				}
			}
		}

		time += System.currentTimeMillis();
		System.out.print("[matching time:" + time + "ms], ");

		time = -System.currentTimeMillis();
		Collections.sort(resultsSD, new SearchResultsComparator());
		time += System.currentTimeMillis();
		System.out.print("[sorting time:" + time + "ms], ");

		totalTime += System.currentTimeMillis();
		System.out.print("TOTAL time:" + totalTime + "ms\n");

		System.out.print("[result size before truncation " + resultsSD.size() + "], ");

		int nHits = Math.min(k, resultsSD.size());
		if (nHits < 1)
			return null;

		SearchResults[] firstKscoreDocs = resultsSD.stream().limit(nHits).collect(Collectors.toList())
				.toArray(new SearchResults[nHits]);
		System.out.println("  [result size after truncation " + firstKscoreDocs.length + "]");

		return firstKscoreDocs;
	}

	/**
	 * Combine a list of top documents returned by a search engine using RRF [1] and topN boosting.
	 * [1] Cormack et al. (2009, July). Reciprocal rank fusion outperforms condorcet and individual
	 *     rank learning methods. In SIGIR 2009. (pp. 758-759).
	 *
	 * @param resultsList The list of TopDocs objects to be merged.
	 * @param n The maximum number of merged documents to return.
	 * @return The merged TopDocs object.
	 */
	private SearchResults[] mergeResultsRRFwithBoostTopN(List<SearchResults[]> resultsList, int topK)
			throws NumberFormatException, IOException {

		long time = -System.currentTimeMillis();
		int nHits = resultsList.size();
		int k_rrf = 100;  // rank constant: higher values give more weight to lower-ranked docs
		int n = 3; //  boosting teh score of the top-k result of each list before merging them
		ConcurrentHashMap<String, SearchResults> fusedScores = new ConcurrentHashMap<>();

		long subTime = -System.currentTimeMillis();
		resultsList.parallelStream().forEach(results -> {
			int maxRank = (int) Math.min(topK, results.length);
			IntStream.range(0, maxRank).parallel().forEach(rank -> {
				SearchResults sr = results[rank];
				String imgID = sr.getImgId();
				sr.score = k_rrf / (float) (rank + k_rrf);
				// score=1 if rank=0, score=0.5 if rank=k_rrf, score 0.1 if rank=9*k_rrf
				if (rank < n) sr.score *= nHits;
				fusedScores.merge(imgID, sr, (existingSr, newSr) -> {
					existingSr.score += newSr.score;
					existingSr.copyFieldsIfMissing(newSr);
					return existingSr;
				});
			});
		});
		subTime += System.currentTimeMillis();

		long subTime2 = -System.currentTimeMillis();
		SearchResults[] results = fusedScores.values().stream() // get stream of SearchResults entries
			.sorted(Collections.reverseOrder()) // sort by descending score
			.limit(topK) // keep top n entries
			.collect(Collectors.toList()) // collect to list
			.toArray(new SearchResults[0]); // convert to array
		subTime2 += System.currentTimeMillis();

		time += System.currentTimeMillis();
		System.out.println("** RRF (with boost top-" + n + ") time: " + time + "ms [RRF:" + subTime + "ms]  [sorting:" + subTime2 + "ms]\t res size:" + results.length);

		return results;
	}

	public TopDocs searchResults2TopDocs(SearchResults[] results) throws IOException { return searchResults2TopDocs(results, true); }
	public TopDocs searchResults2TopDocs(SearchResults[] results, boolean keepScores) throws IOException {
		if (results == null)
			return null;

		ArrayList<ScoreDoc> scoreDocs = new ArrayList<>();
		float maxScore = -1;
		for (int i = 0; i < results.length; i++) {
			Query q = new TermQuery(new Term(Fields.IMG_ID, results[i].getImgId()));
			TopDocs td = s.search(q, 1);
			if (td.totalHits > 0) {
				ScoreDoc sc = td.scoreDocs[0];
				sc.score = keepScores ? (results[i].score + 1) : 0; // LUCIA aggiunto +1 per evitare i negativi ma non dovrebbe succedere mai
				scoreDocs.add(sc);
				if (maxScore < sc.score)
					maxScore = sc.score;
			}
		}

		int nHits = scoreDocs.size();
		TopDocs res = new TopDocs(nHits, scoreDocs.toArray(new ScoreDoc[nHits]), maxScore);

		return res;
	}

	private LRUCache<Integer, SearchResults[]> cvCache = new LRUCache<>(10);
	private LRUCache<Integer, SearchResults[]> clCache = new LRUCache<>(10);

	public SearchResults[] searchByCLIP(String textQuery) throws IOException, org.apache.hc.core5.http.ParseException {
		SearchResults[] res = null;
		if (cvCache.containsKey(textQuery.hashCode()))
			res = cvCache.get(textQuery.hashCode());
		else {
			res = CLIPExtractor.text2CLIPResults(textQuery);
			cvCache.put(textQuery.hashCode(), res);
		}

		return res;
	}

	public SearchResults[] searchByCLIPOne(String textQuery) throws IOException, org.apache.hc.core5.http.ParseException {
		SearchResults[] res = null;
		if (clCache.containsKey(textQuery.hashCode()))
			res = clCache.get(textQuery.hashCode());
		else {
			res = CLIPOneExtractor.text2CLIPResults(textQuery);
			clCache.put(textQuery.hashCode(), res);
		}

		return res;
	}

	public SearchResults[] searchByCLIPID(String queryId, int k) throws org.apache.hc.core5.http.ParseException, IOException {
		System.out.println("clipID: " + queryId);
		return CLIPExtractor.id2CLIPResults(queryId);
	}

	public static void main(String[] args) throws NumberFormatException, IOException {
		String res1 = "6.567852 03551/shot03551_83.png 6.3930883 07053/shot07053_41.png 6.3930883 01009/shot01009_24.png 6.1475897 05709/shot05709_1205.png 6.1475897 02254/shot02254_6.png 6.1475897 07053/shot07053_109.png 6.1475897 06853/shot06853_46.png 6.1475897 05565/shot05565_167.png 6.09558 03249/shot03249_63.png 6.09558 03119/shot03119_160.png 6.09558 02218/shot02218_178.png";
		String res2 = "6.09558 05709/shot05709_3.png 6.09558 03513/shot03513_83.png 6.09558 07342/shot07342_545.png 6.09558 03378/shot03378_76.png 6.09558 02138/shot02138_431.png 6.09558 00670/shot00670_48.png 6.09558 02254/shot02254_3.png 6.09558 03249/shot03249_7.png";
		LucTextSearch test = new LucTextSearch();
		test.openSearcher("/home/paolo/development/java-projects/mim/VBS_2018/out/lucene_vbs");
		// String res = test.mergeResults(res1, res2);
		// System.out.println(res);
	}

}
