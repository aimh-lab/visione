
package it.cnr.isti.visione.logging;

import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

public class Result {

@SerializedName("item")
@Expose
private String item;

@SerializedName("frame")
@Expose
private int frame;

@SerializedName("score")
@Expose
private float score;

@SerializedName("rank")
@Expose
private int rank;

public String getItem() {
return item;
}

public void setItem(String item) {
this.item = item;
}

public int getFrame() {
return frame;
}

public void setFrame(int frame) {
this.frame = frame;
}

public float getScore() {
return score;
}

public void setScore(float score) {
this.score = score;
}

public int getRank() {
return rank;
}

public void setRank(int rank) {
this.rank = rank;
}

}
