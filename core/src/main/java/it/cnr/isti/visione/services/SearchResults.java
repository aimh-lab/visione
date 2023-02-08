package it.cnr.isti.visione.services;


public class SearchResults  {
	
	public float score;
	public String videoId;
	public String imgId;
	public int middleFrame;
	
	public SearchResults(String imgId, String videoId, float score, int middleFrame) {
		this.videoId = videoId;
		this.imgId = imgId;
		this.middleFrame = middleFrame;
		this.score = score;
	}
}
