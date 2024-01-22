package it.cnr.isti.visione.lucene;

import org.apache.lucene.search.similarities.TFIDFSimilarity;
import org.apache.lucene.util.BytesRef;

/** Expert: Default scoring implementation. */
public class DotProduct extends TFIDFSimilarity {

	/** Sole constructor: parameter-free */
	public DotProduct() {
	}

	@Override
	public float idf(long arg0, long arg1) {
		return 1f;
	}

	@Override
	public float scorePayload(int arg0, int arg1, int arg2, BytesRef arg3) {
		return 1f;
	}

	@Override
	public float sloppyFreq(int arg0) {
		return 1f;
	}

	@Override
	public float tf(float arg0) {
		return arg0;
	}

	@Override
	public float lengthNorm(int arg0) {
		return 1f;
	}

}