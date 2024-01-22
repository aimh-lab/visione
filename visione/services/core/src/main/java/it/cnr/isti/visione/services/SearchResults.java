package it.cnr.isti.visione.services;

import java.io.File;
import java.io.IOException;
import java.io.Serializable;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import org.apache.lucene.document.Document;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;

import it.cnr.isti.visione.lucene.Fields;

public class SearchResults implements Comparable<SearchResults> {

	public float score;
	private String imgId = null;
	private String videoId = null;
	private int middleFrame = -1;
	private long middleTime = -1;

	private Integer luceneDocId = null;
	private Document luceneDoc = null;

	public static IndexSearcher searcher = null;
	public static Map<String, FieldCache> fieldCache = new HashMap<>();

	private static class FieldCache implements Serializable {
		public String videoId;
		public int middleFrame;
		public long middleTime;
	}

	static {
		// check if field cache file exists
		File fieldCacheFile = new File("/data/field-cache.dat");
		if (fieldCacheFile.exists()) {
			try {
				// load field cache from file
				System.out.println("Loading field cache from file...");
				fieldCache = (Map<String, FieldCache>) new ObjectInputStream(new FileInputStream(fieldCacheFile)).readObject();
				System.out.println("Field cache loaded.");
			} catch (Exception e) {
				e.printStackTrace();
			}
		} else {
			System.out.println("Creating field cache.");

			// glob all directories in /data/selected-frames/
			File[] dirs = new File("/data/selected-frames/").listFiles(File::isDirectory);

			// for each <dir>, read the <dir>/<dir>-scenes.csv
			Stream.of(dirs)
				.map(dir -> new File(dir, dir.getName() + "-scenes.csv"))
				.filter(File::exists)
				.forEach(scenesFile -> {
					try {
						String videoId = scenesFile.getParentFile().getName();
						List<String> lines = Files.readAllLines(scenesFile.toPath());
						int nDigits = Math.max(3, (int) Math.floor(Math.log10(lines.size())));

						// create a column -> idx map using first line header
						String[] header = lines.get(0).split(",");
						Map<String, Integer> colMap = IntStream.range(0, header.length).boxed().collect(Collectors.toMap(i -> header[i], i -> i));
						
						lines.stream().skip(1).forEach(line -> {
							String[] fields = line.split(",");
							int sceneNumber = Integer.parseInt(fields[colMap.get("Scene Number")]);
							int startFrame = Integer.parseInt(fields[colMap.get("Start Frame")]);
							int endFrame = Integer.parseInt(fields[colMap.get("End Frame")]);
							long startTimeMs = (long) (Double.parseDouble(fields[colMap.get("Start Time (seconds)")]) * 1000);
							long endTimeMs = (long) (Double.parseDouble(fields[colMap.get("End Time (seconds)")]) * 1000);

							String imgId = videoId + "-" + String.format("%0" + nDigits + "d", sceneNumber);
							int middleFrame = (startFrame + endFrame) / 2;
							long middleTime = (startTimeMs + endTimeMs) / 2;
							
							// add to field cache
							FieldCache fc = new FieldCache();
							fc.videoId = videoId;
							fc.middleFrame = middleFrame;
							fc.middleTime = middleTime;
							fieldCache.put(imgId, fc);
						});
					} catch (IOException e) {
						System.err.println("Error reading file: " + scenesFile);
						e.printStackTrace();
					}
				});
			
			// save field cache to file
			try {
				new ObjectOutputStream(new FileOutputStream(fieldCacheFile)).writeObject(fieldCache);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	public SearchResults(SearchResults other) {
		this.imgId = other.imgId;
		this.videoId = other.videoId;
		this.score = other.score;
		this.middleFrame = other.middleFrame;
		this.middleTime = other.middleTime;
		this.luceneDocId = other.luceneDocId;
	}

	public SearchResults(ScoreDoc scoreDoc) {
		this.luceneDocId = scoreDoc.doc;
		this.score = scoreDoc.score;
	}

	public SearchResults(String imgId, float score) {
		this.imgId = imgId;
		this.score = score;
	}

	public String toString() {
		// tabular format with fixed widths
		return String.format("%-4.3f %-10s (%s @ t=%d/n=%d)", score, imgId, videoId, middleTime, middleFrame);
	}

	@Override
	public int compareTo(SearchResults other) {
		if (this.score < other.score)
			return -1;
		if (this.score > other.score)
			return 1;
		return 0;
	}

	public boolean populate() {
		if (luceneDocId == null && imgId == null) {
			System.err.println("ERR: luceneDocId and imgId are both null");
			return false;
		}

		// populate fields
		getImgId();
		getVideoId();
		getMiddleFrame();
		getMiddleTime();

		return true;
	}

	public int getLuceneDocId() {
		if (luceneDocId != null) return luceneDocId;
		if (imgId == null) return -1;
		// get luceneDocId by searching from imgId
		try {
			TopDocs td = searcher.search(new TermQuery(new Term(Fields.IMG_ID, imgId)), 1);
			if (td.totalHits == 0) { // not found
				System.err.println("Image not found in index: " + imgId);
				return -1;
			}

			luceneDocId = td.scoreDocs[0].doc;
			return luceneDocId;
		} catch (IOException e) {
			e.printStackTrace();
			return -1;
		}
	}

	private void populateFromFieldCache(FieldCache fc) {
		// System.out.println("Populating from field cache: " + imgId);
		videoId = fc.videoId;
		middleFrame = fc.middleFrame;
		middleTime = fc.middleTime;
	}

	public Document getLuceneDoc() {
		if (luceneDoc == null)
			try {luceneDoc = searcher.doc(getLuceneDocId()); } catch (IOException e) { e.printStackTrace(); }
		return luceneDoc;
	}
	
	public String getImgId() {
		if (imgId == null) imgId = getLuceneDoc().get(Fields.IMG_ID);
		return imgId;
	}

	public String getVideoId() {
		if (videoId != null) return videoId;
		if (fieldCache != null) {
			FieldCache fc = fieldCache.get(getImgId());
			if (fc != null) {
				populateFromFieldCache(fc);
				return videoId;
			}
		}
		
		// fallback to lucene doc
		videoId = getLuceneDoc().get(Fields.VIDEO_ID);
		return videoId;
	}

	public int getMiddleFrame() {
		if (middleFrame >= 0) return middleFrame;
		if (fieldCache != null) {
			FieldCache fc = fieldCache.get(getImgId());
			if (fc != null) {
				populateFromFieldCache(fc);
				return middleFrame;
			}
		}

		// fallback to lucene doc
		middleFrame = Integer.parseInt(getLuceneDoc().get(Fields.MIDDLE_FRAME));
		return middleFrame;
	}

	public long getMiddleTime() {
		if (middleTime >= 0) return middleTime;
		if (fieldCache != null) {
			FieldCache fc = fieldCache.get(getImgId());
			if (fc != null) {
				populateFromFieldCache(fc);
				return middleTime;
			}
		}

		// fallback to lucene doc
		middleTime = (long) (Double.parseDouble(getLuceneDoc().get(Fields.MIDDLE_TIME)) * 1000);
		return middleTime;
	}

	public void copyFieldsIfMissing(SearchResults other) {
		if (this.imgId == null) this.imgId = other.imgId;
		if (this.videoId == null) this.videoId = other.videoId;
		if (this.middleFrame == -1) this.middleFrame = other.middleFrame;
		if (this.middleTime == -1) this.middleTime = other.middleTime;
		if (this.luceneDocId == null) this.luceneDocId = other.luceneDocId;
	}
}
