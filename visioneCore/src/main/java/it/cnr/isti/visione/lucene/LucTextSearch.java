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
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map.Entry;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import javax.ws.rs.QueryParam;

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
import org.apache.lucene.search.LRUQueryCache;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.QueryCache;
import org.apache.lucene.search.QueryCachingPolicy;
import org.apache.lucene.search.QueryRescorer;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;
import org.apache.lucene.search.UsageTrackingQueryCachingPolicy;
import org.apache.lucene.search.similarities.BM25Similarity;
import org.apache.lucene.search.similarities.ClassicSimilarity;
import org.apache.lucene.search.similarities.Similarity;
import org.apache.lucene.store.FSDirectory;
import org.apache.lucene.store.MMapDirectory;
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
	private IndexSearcher s;
	private IndexReader ir;

	private QueryParser parser;

	private Similarity dotProduct = new DotProduct();
	private Similarity cosineSimilarity = new CosineSimilarity2();
	private Similarity classicSimilarity = new ClassicSimilarity();
	private Similarity bm25Similarity = new BM25Similarity();
	private Similarity dotProductRescaled = new DotProductRescaled();

	private double rescorerWeight = 1;
	private double similarityRescorerWeight = 10000;
	private HashMap<String, Similarity> fieldSimilaties = new HashMap<>();
//	private static 	ObjectQueryPreprocessing objectPrerocessing = new ObjectQueryPreprocessing(Settings.HYPERSET_FILE);
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

	public TopDocs search(VisioneQuery query, int k) throws ParseException, IOException {
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
				System.out.println(booleanQuery);
				
				query4Cache += booleanQuery;
				if (luceneCache.containsKey(query4Cache.hashCode())) {
					hits = luceneCache.get(query4Cache.hashCode());
					System.out.println("\t [lucene query from cache]");
				} else {
					luceneQuery = parser.parse(booleanQuery);
					// System.out.println(luceneQuery);
	
					if (pipelineIdx == 0) {
						time = -System.currentTimeMillis();
						// System.out.println(luceneQuery);
						hits = s.search(luceneQuery, kQuery);
						hits.totalHits = hits.scoreDocs.length;
						time += System.currentTimeMillis();
						System.out.println("\t **Search " + fieldName + " (k: " + kQuery + ")" + ":\t" + time + " ms"
								+ "\t\t(nHits " + hits.totalHits + "---maxScore " + hits.getMaxScore() + ")");
					} else {
	
						if (hits.totalHits > 0) {
	//						System.out.println(luceneQuery.toString() + ": " + field.getWeight() + " k: " + kQuery);
							time = -System.currentTimeMillis();
							float firstPassScore = 1.0f;
							if (fieldName.equals(Fields.ALADIN)) {
								firstPassScore /= hits.getMaxScore();
								// kQuery = k;
							}
							hits = myrescore(s, hits, luceneQuery, firstPassScore, field.getWeight(), kQuery);
							// QueryRescorer.rescore(s, hits, luceneQuery, field.getWeight(), kQuery);//
							hits.totalHits = hits.scoreDocs.length;
							time += System.currentTimeMillis();
							System.out.println("\t \t**Rescore " + fieldName + " (" + "weight:" + field.getWeight() + " k: "
									+ kQuery + "):\t" + time + " ms" + "\t\t(nHits " + hits.totalHits + "---maxScore "
									+ hits.getMaxScore() + ")");
	
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
		return hits;
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

	public ArrayList<SearchResults> topDocs2SearchResults(TopDocs hits, int k) throws IOException {
		ArrayList<SearchResults> results = new ArrayList<>();
		for (int i = 0; i < hits.scoreDocs.length && i < k; i++) {
			int doc = hits.scoreDocs[i].doc;
			float score = hits.scoreDocs[i].score;
			String collection = s.doc(doc).get(Fields.COLLECTION);
			String imgID = s.doc(doc).get(Fields.IMG_ID);
			String videoID = s.doc(doc).get(Fields.VIDEO_ID);
			Integer middleFrame = Integer.parseInt(s.doc(doc).get(Fields.MIDDLE_FRAME));
			results.add(new SearchResults(imgID, videoID, collection, score, middleFrame));
			// System.out.println(score + ", " + imgID);
		}
		return results;
	}

	public ArrayList<SearchResults> topDocs2SearchResults(TopDocs hits) throws IOException {
		return topDocs2SearchResults(hits, hits.scoreDocs.length);
	}

	public TopDocs searchByID(String query, int k, TopDocs hits) throws ParseException, IOException {
//		String[] queries = query.toLowerCase().split(Settings.QUERY_SPLIT);		

		System.out.println("vf: " + query);
		if (query == null)
			return null;

		String visualFeatures = getTerms(query, Fields.VISUAL_FEATURES, true).trim();
		TopDocs res = searchByExample(visualFeatures, k, hits);
//		System.out.println(visualFeatures);
		return res;
	}

	public TopDocs searchByALADINid(String query, int k, TopDocs hits) throws ParseException, IOException {
//		String[] queries = query.toLowerCase().split(Settings.QUERY_SPLIT);
		System.out.println("aladinID: " + query);
		if (query == null)
			return null;
		String visualFeatures = getTerms(query, Fields.ALADIN, true).trim();
		TopDocs res = searchByALADIN(visualFeatures, k, hits);
//		System.out.println(visualFeatures);
		return res;
	}

	public TopDocs searchByExample(String visualFeatures, int k, TopDocs hits) throws ParseException, IOException {
		// s.setSimilarity(dotProduct);
		Similarity sim = fieldSimilaties.get(Settings.IMG_SIM_PARAMETERS.getSimilarity());

		s.setSimilarity(sim);
		String occur = "";

		TopDocs simHits = null;
		String booleanQuery = occur + Fields.VISUAL_FEATURES + ":"
				+ visualFeatures.replaceAll(" ", " " + occur + Fields.VISUAL_FEATURES + ":");
//		System.out.println(booleanQuery);
		Query luceneQuery = parser.parse(booleanQuery);
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
		return simHits;
	}

	public TopDocs searchByALADIN(String visualFeatures, int k, TopDocs hits) throws ParseException, IOException {
		Similarity sim = fieldSimilaties.get(Settings.IMG_SIM_PARAMETERS.getSimilarity());
		s.setSimilarity(sim);

		String occur = "";

		TopDocs simHits = null;
		String booleanQuery = occur + Fields.ALADIN + ":"
				+ visualFeatures.replaceAll(" ", " " + occur + Fields.ALADIN + ":");
		System.out.println(booleanQuery);
		Query luceneQuery = parser.parse(booleanQuery);
		if (hits == null) {
			long time = -System.currentTimeMillis();
			simHits = s.search(luceneQuery, k);
			time += System.currentTimeMillis();
			System.out.println("\t ***Search time: " + time + " ms");
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
			data = s.doc(td.scoreDocs[0].doc).get(field);
		}
		return data;
	}
	
	public List<String> getAllVideoKeyframes(String videoId) throws ParseException, IOException {
		String booleanQuery = "+" + Fields.IMG_ID + ":"	+ videoId + "*";
	
		Query luceneQuery = parser.parse(booleanQuery);
		// System.out.println(luceneQuery);

		TopDocs hits = s.search(luceneQuery, 10000);
		List<String> keyframes = new ArrayList<>();
		for (int i = 0; i <= hits.scoreDocs.length-1; i++) {
			Document document = s.doc(hits.scoreDocs[i].doc);
			String imgID = document.get(Fields.IMG_ID);
			keyframes.add(imgID);
		}
		
		Collections.sort(keyframes, new Tools().new Comp());
		
		return keyframes;
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

//	private class IdRank {
//		private String id;
//		private String collection;
//		private int rank;
//		private float timestamp;
//		private float score;
//
//		public IdRank(String collection, String id, int rank, float score, float timestamp) {
//			this.collection = collection;
//			this.id = id;
//			this.rank = rank;
//			this.timestamp = timestamp;
//			this.score = score;
//
//		}
//
//		public String getId() {
//			return id;
//		}
//
//		public String getCollection() {
//			return collection;
//		}
//
//		public int getRank() {
//			return rank;
//		}
//
//		public float getScore() {
//			return score;
//		}
//
//		public float getTimestamp() {
//			return timestamp;
//		}
//	}

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

	public ConcurrentHashMap<String, ConcurrentHashMap<Integer, ScoreDoc>> getVideoHashMap_th(TopDocs hits,
			int quantizer, Set<String> video_keys) throws NumberFormatException, IOException {
		ConcurrentHashMap<String, ConcurrentHashMap<Integer, ScoreDoc>> hm = new ConcurrentHashMap<>();
		int nDocs = hits.scoreDocs.length;
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
		private final TopDocs hits;
		private final ConcurrentHashMap<String, ConcurrentHashMap<Integer, ScoreDoc>> hm;
		private final int quantizer;
		private final Object sem = new Object();

		public VideoHashMapThread(TopDocs hits, int from, int to,
				ConcurrentHashMap<String, ConcurrentHashMap<Integer, ScoreDoc>> hm, int quantizer) {
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
					float score = hits.scoreDocs[iO].score;
					ScoreDoc scoredoc = new ScoreDoc(hits.scoreDocs[iO].doc, score);
					Document document = s.doc(scoredoc.doc);
					String imgID = document.get(Fields.IMG_ID);
					float timestamp = Float.parseFloat(document.get((Fields.MIDDLE_TIME)));
					String videoId = document.get(Fields.VIDEO_ID);
					Integer id_quantized_timestamp = (int) (timestamp / quantizer); // quantize timestamp
					hm.putIfAbsent(videoId, new ConcurrentHashMap<Integer, ScoreDoc>());
					ConcurrentHashMap<Integer, ScoreDoc> keyframes = hm.get(videoId); // video keyframes (one for each quantized time interval)
					keyframes.putIfAbsent(id_quantized_timestamp, scoredoc);
					ScoreDoc representative_keyframe = keyframes.get(id_quantized_timestamp);
					if (representative_keyframe.score > score)
						continue; // We keep just one keyframe for each quantized time interval
	
					synchronized (sem) {
						keyframes = hm.get(videoId); 
						if( keyframes.get(id_quantized_timestamp).score<score) {
							keyframes.put(id_quantized_timestamp, scoredoc);		
							hm.put(videoId, keyframes);
						}
					}
					
			
				} catch (IOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}
		}
	}

	public class SelectedVideoHashMapThread implements Runnable {
		private final int from;
		private final int to;
		private final TopDocs hits;
		private final ConcurrentHashMap<String, ConcurrentHashMap<Integer, ScoreDoc>> hm;
		private final int quantizer;
		private final Set<String> video_keys;
		private final Object sem = new Object();

		public SelectedVideoHashMapThread(TopDocs hits, int from, int to,
				ConcurrentHashMap<String, ConcurrentHashMap<Integer, ScoreDoc>> hm, Set<String> video_keys,
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
					float score = hits.scoreDocs[iO].score;
					ScoreDoc scoredoc = new ScoreDoc(hits.scoreDocs[iO].doc, score);

					Document document = s.doc(scoredoc.doc);
					String imgID = document.get(Fields.IMG_ID);
					String videoId = document.get(Fields.VIDEO_ID);
					if (!video_keys.contains(videoId))
						continue;
					float timestamp = Float.parseFloat(document.get((Fields.MIDDLE_TIME)));
					Integer id_quantized_timestamp = (int) (timestamp / quantizer); // quantize timestamp
					
					hm.putIfAbsent(videoId, new ConcurrentHashMap<Integer, ScoreDoc>());
					ConcurrentHashMap<Integer, ScoreDoc> keyframes = hm.get(videoId); // video keyframes (one for each quantized time interval)
					keyframes.putIfAbsent(id_quantized_timestamp, scoredoc);
					ScoreDoc representative_keyframe = keyframes.get(id_quantized_timestamp);
					if (representative_keyframe.score > score)
						continue; // We keep just one keyframe for each quantized time interval
	
					synchronized (sem) {
						keyframes = hm.get(videoId); 
						if( keyframes.get(id_quantized_timestamp).score<score) {
							keyframes.put(id_quantized_timestamp, scoredoc);		
							hm.put(videoId, keyframes);
					
						}
					}
						
//					ConcurrentHashMap<Integer, ScoreDoc> keyframes = hm.getOrDefault(videoId,
//							new ConcurrentHashMap<Integer, ScoreDoc>()); // video keyframes (one for each quantized
//																			// timne interval)
//					ScoreDoc representative_keyframe = keyframes.getOrDefault(id_quantized_timestamp, scoredoc);
//					if (representative_keyframe.score > score)
//						continue; // We keep just one keyframe for each quantized time interval
//					keyframes.put(id_quantized_timestamp, representative_keyframe);
//					hm.put(videoId, keyframes);
				} catch (IOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}

		}
	}

	public class VideoSearchResultsHashMapThread implements Runnable {
		private final int from;
		private final int to;
		private final TopDocs hits;
		private final ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> hm;
		private final float quantizer;
		private final Object sem = new Object();

		public VideoSearchResultsHashMapThread(TopDocs hits, int from, int to,
				ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> hm, float quantizer) {
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
					float score = hits.scoreDocs[iO].score;
					ScoreDoc scoredoc = new ScoreDoc(hits.scoreDocs[iO].doc, score);
					Document document = s.doc(scoredoc.doc);
					String imgID = document.get(Fields.IMG_ID);
					String videoID = document.get(Fields.VIDEO_ID);
					String collection = document.get(Fields.COLLECTION);
					float timestamp = Float.parseFloat(document.get((Fields.MIDDLE_TIME)));
					Integer middleFrame = Integer.parseInt(document.get(Fields.MIDDLE_FRAME));


					Integer id_quantized_timestamp = (int) (timestamp / quantizer); // quantize timestamp
						
					hm.putIfAbsent(videoID, new ConcurrentHashMap<Integer, SearchResults>());
					ConcurrentHashMap<Integer, SearchResults> keyframes = hm.get(videoID); // video keyframes (one for each quantized time interval)
					
					keyframes.putIfAbsent(id_quantized_timestamp, new SearchResults(imgID, videoID, collection, score, middleFrame));
					SearchResults representative_keyframe = keyframes.get(id_quantized_timestamp);
					if (representative_keyframe.score > score)
						continue; // We keep just one keyframe for each quantized time interval
					
					synchronized (sem) {
						keyframes = hm.get(videoID); 
						if( keyframes.get(id_quantized_timestamp).score<score) {
							keyframes.put(id_quantized_timestamp, new SearchResults(imgID, videoID, collection, score, middleFrame));		
							hm.put(videoID, keyframes);
						}
					}
					
//					ConcurrentHashMap<Integer, SearchResults> keyframes = hm.getOrDefault(videoId,
//							new ConcurrentHashMap<Integer, SearchResults>()); // video keyframes (one for each quantized
//																// timne interval)
//			
//					SearchResults representative_keyframe = keyframes.getOrDefault(id_quantized_timestamp,
//							new SearchResults(imgID, collection, score));
//
//					if (representative_keyframe.score > score)
//						continue; // We keep just one keyframe for each quantized time interval
//					keyframes.put(id_quantized_timestamp, representative_keyframe);
//					hm.put(videoId, keyframes);
				} catch (IOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}
		}
	}

	public ArrayList<SearchResults> sortByVideo(TopDocs hits, int n_frames_per_row, int maxRes) {
		if (hits == null)
			return null;
		TopDocs hitsClone = topDocsClone(hits, maxRes);
		long total_time = -System.currentTimeMillis();
		ArrayList<SearchResults> results = new ArrayList<>();
		if (hitsClone == null)
			return results;

		float quantizer = 1; // 1 second quantization

		ConcurrentHashMap<String, ConcurrentHashMap<Integer, SearchResults>> hm = new ConcurrentHashMap<>();
		int nDocs = hitsClone.scoreDocs.length;
		int bookedThreads = Runtime.getRuntime().availableProcessors() - 1;
		final int nObjsPerThread = (int) Math.ceil((double) nDocs / (bookedThreads));
		final int nThread = (int) Math.ceil((double) nDocs / nObjsPerThread);

		int ti = 0;
		Thread[] thread = new Thread[nThread];

		for (int from = 0; from < nDocs; from += nObjsPerThread) {// TODO possiamo pensare di modificate nDoc con un
																	// maxK
			int to = from + nObjsPerThread - 1;
			if (to >= nDocs)
				to = nDocs - 1;
			thread[ti] = new Thread(new VideoSearchResultsHashMapThread(hitsClone, from, to, hm, quantizer));
			thread[ti].start();
			ti++;
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

		HashMap<String, Float> videoScoreHashMap = new HashMap<>();
		HashMap<String, List<SearchResults>> videoResHashMap = new HashMap<>();
		for (String videoID : hm.keySet()) {
			ConcurrentHashMap<Integer, SearchResults> videoHM = hm.get(videoID);
			List<SearchResults> videoRes = new ArrayList<SearchResults>(videoHM.values());
			videoRes.sort(new SearchResultsComparator());
			videoRes = videoRes.subList(0, Math.min(n_frames_per_row, videoRes.size()));
			float maxscore = videoRes.get(0).score;
			videoScoreHashMap.put(videoID, maxscore);
			videoResHashMap.put(videoID, videoRes);
		}
		List<Entry<String, Float>> videolist = new LinkedList<>(videoScoreHashMap.entrySet());
		videolist.sort((k1, k2) -> -(k1.getValue()).compareTo(k2.getValue()));
		for (Entry<String, Float> entry : videolist) {
			results.addAll(videoResHashMap.get(entry.getKey()));
			
		}

		total_time += System.currentTimeMillis();
		System.out.println("**last reordering time:" + total_time + "ms" + "\t res size:" + results.size());

		return results;

	}

	private float nomalize_score(float score, float min, float max, float interpolation_factor) {
		return interpolation_factor * (score - min) / (max - min);// linear scaling (min-max scaler)//This Scaler is
																	// sensitive to outliers
		// return interpolation_factor*score/max; //max abs scaler , also suffers from
		// the presence of significant outliers.
	}

	public TopDocs mergeHits(TopDocs td0, TopDocs td1, int k) { // Lucia: I assume that td0 (e.g CLIP) is better than
																// td1
		float lambda = 0.7f;
		ScoreDoc[] hits0 = td0.scoreDocs.clone();
		ScoreDoc[] hits1 = td1.scoreDocs.clone();
		float[] minscores = { 0.8f * hits0[hits0.length - 1].score, hits1[hits1.length - 1].score };// hits0 may be an
																									// order of
																									// magnitude shorter
																									// than hits1, I
																									// assume that the
																									// "real" min is
																									// lower that the
																									// one measured in
																									// hits
		float[] maxscores = { td0.getMaxScore(), td1.getMaxScore() };
		// for(int i=0; i<200; i++) {
		// float test0=nomalize_score(hits0[i].score, minscores[0], maxscores[0],1);
		// float test1=nomalize_score(hits1[i].score, minscores[1], maxscores[1],1);
		// System.out.println("test0: "+test0+"-- test1 "+ test1);
		// }

		int boost = Math.min(10, Math.min(hits0.length, hits1.length)); // boosting the first 10 results of both the
																		// list (they will have a score greater then 1)
		for (int i = 0; i < boost; i++) {
			hits0[i].score *= 2;
			hits1[i].score *= 2;

		}

		long total_time = -System.currentTimeMillis();
		Arrays.sort(hits0, new Comparator<ScoreDoc>() {
			@Override
			public int compare(ScoreDoc a, ScoreDoc b) {
				return a.doc - b.doc;
			}
		});
		Arrays.sort(hits1, new Comparator<ScoreDoc>() {
			@Override
			public int compare(ScoreDoc a, ScoreDoc b) {
				return a.doc - b.doc;
			}
		});

		// Now merge sort docIDs from hits,
		ArrayList<ScoreDoc> mergedRes = new ArrayList<ScoreDoc>();

		int hit1Upto = 0;
		for (int i0 = 0; i0 < hits0.length; i0++) {
			ScoreDoc sc0 = hits0[i0];
			int docID0 = sc0.doc;
			sc0.score = nomalize_score(sc0.score, minscores[0], maxscores[0], lambda);

			while (hit1Upto < hits1.length && hits1[hit1Upto].doc < docID0) {
				ScoreDoc sc1 = hits1[hit1Upto];
				sc1.score = nomalize_score(sc1.score, minscores[1], maxscores[1], 1 - lambda);
				mergedRes.add(sc1);
				hit1Upto++;
			}
			if (hit1Upto < hits1.length && hits1[hit1Upto].doc == docID0) {// caso in cui sono uscita dal while con un
																			// match
				ScoreDoc sc1 = hits1[hit1Upto];
				sc1.score = nomalize_score(sc1.score, minscores[1], maxscores[1], 1 - lambda);
				sc0.score = (sc0.score + sc1.score); // lo score del match lo metto in sc0
				hit1Upto++;
			}
			mergedRes.add(sc0);
		}

		while (hit1Upto < hits1.length) {// caso in cui ho finito di scorrere la prima lista ma non la seconda
			ScoreDoc sc1 = hits1[hit1Upto];
			sc1.score = nomalize_score(sc1.score, minscores[1], maxscores[1], 1 - lambda);
			mergedRes.add(sc1);
			hit1Upto++;
		}

		Collections.sort(mergedRes, new ScoreDocsComparator()); // riordino in base allo score
		k = Math.min(mergedRes.size(), k);
		ScoreDoc[] firstKscoreDocs = mergedRes.stream().limit(k).collect(Collectors.toList()).toArray(new ScoreDoc[k]);

		total_time += System.currentTimeMillis();
		System.out.println("combining 2 hits time:" + total_time + "ms");

		return new TopDocs(firstKscoreDocs.length, firstKscoreDocs, firstKscoreDocs[0].score);

	}

	public TopDocs mergeResults(List<TopDocs> topDocsList, int topK, boolean temporalquery)
			throws NumberFormatException, IOException {
		topDocsList = topDocsList.stream().filter(x -> x != null).collect(Collectors.toList());
		int nHitsToMerge = topDocsList.size();
		TopDocs res = null;
		
		if (nHitsToMerge >= 1) { 
			if (nHitsToMerge == 1) {//only one topDocs hits
				TopDocs td = topDocsList.get(0);
				if (td.totalHits > topK) {
					td.scoreDocs = Arrays.copyOf(td.scoreDocs, topK);
				}
				res = td;
			}	
			else { //two or more topDocs
				if (temporalquery)
					res = combineResults_temporal(topDocsList, topK, 7, 21);
				else {
					res =combineResults(topDocsList, topK);
//					if (nHitsToMerge == 2 && topDocsList.get(0).totalHits > 0 && topDocsList.get(1).totalHits > 0)
//						res = mergeHits(topDocsList.get(0), topDocsList.get(1), topK); // clip is topDocsList.get(0), ALADIN is																	// topDocsList.get(1)
//					else
//						res = combineResults_temporal(topDocsList, topK, 2, 4);// qui entra se ci sono >=3 topDocs																// arrivarci mai ma da controllare!
//					
				
				}
				}
		}
		return res; //case nHitsToMerge <1, i.e. res=null
	}
	
//	private LRUCache<Integer, ConcurrentHashMap<Integer, ConcurrentHashMap<Integer, ScoreDoc>>> mergeCache = new LRUCache<>(10);


	private TopDocs combineResults_temporal(List<TopDocs> topDocsList, int k, int time_quantizer, float timeinterval)
			throws NumberFormatException, IOException {
		int nHitsToMerge = topDocsList.size();
		long total_time = -System.currentTimeMillis();
		int qi = Math.round(timeinterval / (float) time_quantizer); // used for searching quantized interval
		float max_scores[] = new float[nHitsToMerge];

		long time = -System.currentTimeMillis();
		Collections.sort(topDocsList, new Comparator<TopDocs>() {
			@Override
			public int compare(TopDocs o1, TopDocs o2) {
				return Long.compare(o1.totalHits, o2.totalHits);
			}
		});

		
		ConcurrentHashMap<String, ConcurrentHashMap<Integer, ScoreDoc>>[] shmap = new ConcurrentHashMap[nHitsToMerge];
		Set<String> videoIds = null;
		for (int i = 0; i < nHitsToMerge; i++) {
			TopDocs hits_i = topDocsList.get(i);
			shmap[i] = getVideoHashMap_th(hits_i, time_quantizer, videoIds); // hashing  hits_i
			//TODO add a cache for the hashing?
			if(i==0)
				videoIds=shmap[i].keySet();
			else
				videoIds.retainAll(shmap[i].keySet()); // videoIds is already the intersection of the videos
			//videoIds.addAll(shmap[i].keySet()); //video ids is the union 
			max_scores[i] = hits_i.getMaxScore();
		}
		time += System.currentTimeMillis();
		System.out.print("*[hashing:" + time + "ms]\t");

		// matching
		time = -System.currentTimeMillis();
		ArrayList<ScoreDoc> resultsSD = new ArrayList<>();
		for (String videoId : videoIds) {
			ConcurrentHashMap<Integer, ScoreDoc>[] hm = new ConcurrentHashMap[nHitsToMerge];
			for (int i = 0; i < nHitsToMerge; i++) {
				hm[i] = shmap[i].get(videoId);
			}

			List<Entry<Integer, ScoreDoc>> listOfEntries0 = new ArrayList(hm[0].entrySet());
			Collections.sort(listOfEntries0, new EntryScoreDocComparator()); // sort first list using score

			HashSet<Integer> idResTime = new HashSet<Integer>(); // one result for each
			HashSet<String> idResKeyframe = new HashSet<String>(); // one result for each
			for (Entry<Integer, ScoreDoc> k0 : listOfEntries0) { // entries of the first hits (ranked by highest score)
				Integer id_t0 = k0.getKey();
				if (idResTime.contains(id_t0))
					continue;

				ScoreDoc[] best_sr = new ScoreDoc[nHitsToMerge];
				Integer best_id_t[] = new Integer[nHitsToMerge];
				best_sr[0] = k0.getValue();
				best_id_t[0] = id_t0;
				float aggregated_score = best_sr[0].score / max_scores[0]; /// max_scores[0]

				for (int i = 1; i < nHitsToMerge; i++) {
					best_sr[i] = null;
					float best_score = -1;

					for (int interval = -qi; interval < qi + 1; interval++) {
						// searching a match in the i-th list
						Integer id_t_i = id_t0 + interval;
						ScoreDoc sr_i = hm[i].get(id_t_i); // matching keyframe
						if (sr_i == null || idResTime.contains(id_t_i))
							continue;
						float score = // sr_i.score* aggregated_score; //geometric mean without sqrt(since sqrt is
										// monotonic)
								// 2*(sr_i.score* aggregated_score)/(sr_i.score+ aggregated_score); //harmonic
								// mean
								sr_i.score / max_scores[i] + aggregated_score; // arithmetic mean NOTE: you should
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

				if (best_sr[nHitsToMerge - 1] != null) { // we have a match
					for (int i = 0; i < nHitsToMerge; i++) {
						int doc = best_sr[i].doc;
						String imgID = s.doc(doc).get(Fields.IMG_ID);
						if (idResKeyframe.contains(imgID)) {
							continue;
						}
						ScoreDoc ssi = new ScoreDoc(best_sr[i].doc, aggregated_score);

						resultsSD.add(ssi);
						idResKeyframe.add(imgID);
						idResTime.add(best_id_t[i]);
					}

				}
			}
		}

		time += System.currentTimeMillis();
		System.out.print("[matching time:" + time + "ms]\t");

		time = -System.currentTimeMillis();
		Collections.sort(resultsSD, new ScoreDocsComparator());
		time += System.currentTimeMillis();
		System.out.print("[sorting time:" + time + "ms]\t");

		total_time += System.currentTimeMillis();
		System.out.print("total TEMPORAL MERGE time:" + total_time + "ms\t\t");

		System.out.print("[result size before truncation " + resultsSD.size() + "]\t");

		int nHits = Math.min(k, resultsSD.size());
		if (nHits < 1)
			return null;

		ScoreDoc[] firstKscoreDocs = resultsSD.stream().limit(nHits).collect(Collectors.toList())
				.toArray(new ScoreDoc[nHits]);
		System.out.println("  [result size after truncation " + firstKscoreDocs.length + "]");

		return new TopDocs(nHits, firstKscoreDocs, firstKscoreDocs[0].score);

	}

	private TopDocs combineResults(List<TopDocs> topDocsList, int k)
			throws NumberFormatException, IOException {
		long total_time = -System.currentTimeMillis();	
		int time_quantizer=3;
		int nHitsToMerge = topDocsList.size();
		
		
	

		long time = -System.currentTimeMillis();
		Collections.sort(topDocsList, new Comparator<TopDocs>() {
			@Override
			public int compare(TopDocs o1, TopDocs o2) {
				return Long.compare(o1.totalHits, o2.totalHits);
			}
		});


		ConcurrentHashMap<String, ConcurrentHashMap<Integer, ScoreDoc>>[] shmap = new ConcurrentHashMap[nHitsToMerge];
		Set<String> videoIds = new HashSet<String> ();
		float lambda= 10.0f/nHitsToMerge; //I used 10 to avoid  too small number (e.g. 10^-6)
		
		
		for (int i = 0; i < nHitsToMerge; i++) {
			TopDocs hits_i = topDocsList.get(i);
			if(hits_i==null)
				continue;
			int max_res_each_hits=(int)Math.min(k, hits_i.totalHits);
			float max_score= hits_i.getMaxScore();			
			float min_score= hits_i.scoreDocs[max_res_each_hits - 1].score;
			ScoreDoc[] scoreDocs=new ScoreDoc[max_res_each_hits] ;
			//boost first 10 results and normalize the others (up to max_res_each_hits)
			for (int r=0; r< max_res_each_hits; r++) {
				ScoreDoc sd=hits_i.scoreDocs[r];
				float score=nomalize_score(sd.score, min_score, max_score, lambda);
				if(r<10)
					score *= nHitsToMerge;
				scoreDocs[r]=new ScoreDoc(sd.doc, score);
			}
			TopDocs modified_hits_i=new TopDocs(scoreDocs.length, scoreDocs, scoreDocs[0].score);
			shmap[i] = getVideoHashMap_th(modified_hits_i, time_quantizer, null); // hashing  hits_i
			videoIds.addAll(shmap[i].keySet()); //videoIds is the union of all the videos in the topDocsList 

		}
		time += System.currentTimeMillis();
		System.out.print("[hashing:" + time + "ms]\t");

		// matching
		time = -System.currentTimeMillis();
		ArrayList<ScoreDoc> resultsSD = new ArrayList<>();

		for (String videoId : videoIds) {
			ConcurrentHashMap<Integer, HashSet<Integer>> hm_docs = new ConcurrentHashMap<Integer, HashSet<Integer>>();
			ConcurrentHashMap<Integer, Float> hm_score = new ConcurrentHashMap<Integer, Float>();
			for (int i = 0; i < nHitsToMerge; i++) {
				ConcurrentHashMap<Integer, ScoreDoc> hm_i=shmap[i].get(videoId);
				if(hm_i==null)
					continue;
				//List<Entry<Integer, ScoreDoc>> listOfEntries = new ArrayList(hm_i.entrySet());
				for (Entry<Integer, ScoreDoc> entry : hm_i.entrySet()) {
					Integer id_t = entry.getKey();
					ScoreDoc sd=entry.getValue();
					float aggregated_score=sd.score;
					HashSet docSet=hm_docs.getOrDefault(id_t,new HashSet<Integer>());
					aggregated_score+=hm_score.getOrDefault(id_t, 0.0f);
					docSet.add(sd.doc);
					hm_docs.put(id_t, docSet);
					hm_score.put(id_t, aggregated_score);

				}
			}
			//save merged results of the considered video
			
			for(Entry<Integer, HashSet<Integer>> entry_docs:hm_docs.entrySet()) {
				Integer id_t = entry_docs.getKey();
				HashSet<Integer> docSet=entry_docs.getValue();
				float agg_score=hm_score.get(id_t);
				for( int doc: docSet) {

					ScoreDoc ssi = new ScoreDoc(doc, agg_score);
					resultsSD.add(ssi);

				}

			}

		}

		time += System.currentTimeMillis();
		System.out.print("[matching time:" + time + "ms]\t");

		time = -System.currentTimeMillis();
		Collections.sort(resultsSD, new ScoreDocsComparator());
		time += System.currentTimeMillis();
		System.out.print("[sorting time:" + time + "ms]\t");

		total_time += System.currentTimeMillis();
		System.out.print("total HITS COMBINE time:" + total_time + "ms\t");

		System.out.print("[result size before truncation " + resultsSD.size() + "]\t");

		int nHits = Math.min(k, resultsSD.size());
		if (nHits < 1)
			return null;

		ScoreDoc[] firstKscoreDocs = resultsSD.stream().limit(nHits).collect(Collectors.toList())
				.toArray(new ScoreDoc[nHits]);
		System.out.println("  [result size after truncation " + firstKscoreDocs.length + "]");

		return new TopDocs(nHits, firstKscoreDocs, firstKscoreDocs[0].score);

	}
	
	
	
	
	
	class MaxValue {
		public int row;
		private int col;
		private float maxValue;

		public void findMax(float mat[][], Integer[] rows, Integer[] cols) {
			row = -1;
			col = -1;
			maxValue = 0;

			for (int i : rows) {
				if (i == -1)
					continue;
				// if (rowCounter++ > 100 && maxValue > 0)
				// return;
				int colCounter = 0;
				for (int j : cols) {
					if (j == -1)
						continue;
					if (mat[i][j] > maxValue) {
						maxValue = mat[i][j];
						row = i;
						col = j;
					}
					// if (colCounter++ > 50 && maxValue > 0)
					// break;
				}
			}
		}

	}

	public TopDocs searchResults2TopDocs(SearchResults[] results, String collection) throws IOException {
		ArrayList<ScoreDoc> scoredocs = new ArrayList<>();
		float maxScore = -1;
		for (int i = 0; i < results.length; i++) {
			
			String videoId = results[i].imgId.split("_")[0]; //TODO  video ID 
			String imageId = results[i].imgId;
			if(collection.equals("mvk")) {
				videoId = results[i].imgId.substring(0, results[i].imgId.lastIndexOf("_"));
			}
			
			
			Query q = new TermQuery(new Term(Fields.IMG_ID, imageId));
			TopDocs td = s.search(q, 1);
			if (td.totalHits > 0) {
				ScoreDoc sc = td.scoreDocs[0];
				float score = (results[i].score + 1);// LUCIA aggiunto +1 per evitare i negativi manon dovrebe succedere
														// mai
				sc.score = score;
				scoredocs.add(sc);
				if (maxScore < score)
					maxScore = score;
			}
		}
		// System.out.println(res);
		int nHits = scoredocs.size();
		TopDocs res = new TopDocs(nHits, scoredocs.toArray(new ScoreDoc[nHits]), maxScore);
		return res;
	}

//	private TopDocs prevClipRes;
//	private String prevClipQuery;

	private LRUCache<Integer, TopDocs> clipCache = new LRUCache<>(10);
	private LRUCache<Integer, TopDocs> clipponeCache = new LRUCache<>(10);

	public TopDocs searchByCLIP(String textQuery, String collection) throws IOException, org.apache.hc.core5.http.ParseException {
		TopDocs res = null;
		if (clipCache.containsKey(textQuery.hashCode()))
			res = clipCache.get(textQuery.hashCode());
		else {
			res = searchResults2TopDocs(CLIPExtractor.text2CLIPResults(textQuery, collection),collection);
			clipCache.put(textQuery.hashCode(), res);
		}

		return res;
	}
	
	public TopDocs searchByCLIPOne(String textQuery, String collection) throws IOException, org.apache.hc.core5.http.ParseException {
		TopDocs res = null;
		if (clipponeCache.containsKey(textQuery.hashCode()))
			res = clipponeCache.get(textQuery.hashCode());
		else {
			res = searchResults2TopDocs(CLIPOneExtractor.text2CLIPResults(textQuery, collection),collection);
			clipponeCache.put(textQuery.hashCode(), res);
		}

		return res;
	}

	public TopDocs searchByCLIPID(String queryId, int k, String collection) throws org.apache.hc.core5.http.ParseException, IOException {
		return (searchResults2TopDocs(CLIPExtractor.id2CLIPResults(queryId, collection), collection));
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
